import Debug from "debug";
import {mysql2Pool, validateUser} from "chums-local-modules";
import {Router} from "express";
import {sendLocalsResponse} from '../base.js'
import {checkSellAs, SELL_AS} from './utils.js';
import {validateAdmin} from "../common.js";

const debug = Debug('chums:lib:product:mix');

const router = Router();

/**
 * @typedef {Object} Color
 * @property {number} id
 * @property {string} code
 * @property {string} name
 */
/**
 * @typedef {Object} MixDetail
 * @property {number} id
 * @property {number} mixID
 * @property {number} itemCode
 * @property {number} itemQuantity
 * @property {Color} color
 */

/**
 * @typedef {Object} Mix
 * @property {number} id
 * @property {number} productId
 * @property {string} itemCode
 * @property {string} mixName
 * @property {number} status
 * @property {number} [msrp]
 * @property {number} [stdPrice]
 * @property {string} [priceCode]
 * @property {string} [stdUM]
 * @property {string} [salesUM]
 * @property {number} [salesUMFactor]
 * @property {number} [shipWeight]
 * @property {string} [productType]
 * @property {string} [QuantityAvailable]
 * @property {number} [inactiveItem]
 * @property {string} [timestamp]
 * @property {MixDetail[]} detail
 */
/**
 *
 * @param {Object} params
 * @param {number} [params.mixID]
 * @param {number} [params.productsID]
 * @returns {Promise<MixDetail[]>}
 */
export async function loadItems({mixID, productsID}) {
    try {
        const sql = `SELECT d.MixDetailID  AS id,
                            m.mixID,
                            d.ItemCode     AS itemCode,
                            d.ItemQuantity AS itemQuantity,
                            d.colorsId,
                            c.color_code,
                            c.color_name,
                            (SELECT additionalData
                             FROM b2b_oscommerce.products_items i
                             WHERE i.itemCode = d.ItemCode
                             LIMIT 1)      as additionalData
                     FROM b2b_oscommerce.products_mixes m
                              INNER JOIN b2b_oscommerce.products_mixes_detail d
                                         ON d.mixID = m.mixID
                              LEFT JOIN b2b_oscommerce.colors c
                                        ON c.colors_id = d.colorsId
                     WHERE (ISNULL(:mixID) OR m.mixID = :mixID)
                       AND (ISNULL(:productsID) OR m.productsID = :productsID)
                     ORDER BY d.ItemCode`;
        const args = {mixID, productsID};
        const [rows] = await mysql2Pool.query(sql, args);

        return rows.map(row => {
            const {id, mixId, itemCode, itemQuantity, colorsId, color_code, color_name, additionalData} = row;
            let itemData = {};
            try {
                itemData = JSON.parse(additionalData || '{}');
            } catch (err) {
            }
            return {
                id, mixId, itemCode, itemQuantity,
                additionalData: itemData,
                color: {
                    id: colorsId,
                    code: color_code,
                    name: color_name
                }
            }
        });
    } catch (err) {
        debug("loadItems()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {number?} [params.mixID]
 * @param {number?} [params.productsID]
 */
async function loadMix({mixID, productsID}) {
    try {
        const sql = `SELECT mix.mixID                       AS id,
                            mix.productsID                  AS productId,
                            mix.itemCode,
                            mix.mixName,
                            mix.active                      AS status,
                            ci.SuggestedRetailPrice         AS msrp,
                            ci.StandardUnitPrice            AS stdPrice,
                            ci.PriceCode                    AS priceCode,
                            ci.StandardUnitOfMeasure        AS stdUM,
                            ci.SalesUnitOfMeasure           AS salesUM,
                            ci.SalesUMConvFctr              AS salesUMFactor,
                            ci.ShipWeight                   AS shipWeight,
                            ci.ProductType                  AS productType,
                            w.QuantityAvailable,
                            IF(ci.InactiveItem = 'Y', 1, 0) AS inactiveItem,
                            w.buffer,
                            mix.timestamp
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.products_mixes mix
                                         ON p.products_id = mix.productsID
                              LEFT JOIN b2b_oscommerce.manufacturers m
                                        ON p.manufacturers_id = m.manufacturers_id
                              LEFT JOIN c2.ci_item ci
                                        ON ci.Company = m.company AND ci.ItemCode = mix.itemCode
                              LEFT JOIN c2.v_web_available w
                                        ON w.Company = ci.company AND w.ItemCode = ci.ItemCode AND
                                           w.WarehouseCode = ci.DefaultWarehouseCode
                     WHERE (ISNULL(:mixID) OR mix.mixID = :mixID)
                       AND (ISNULL(:productsID) OR p.products_id = :productsID)
                     ORDER BY mix.ItemCode`;
        const args = {mixID, productsID};
        const [rows] = await mysql2Pool.query(sql, args);

        for await (const row of rows) {
            const {id} = row;
            row.items = await loadItems({mixID: id});
        }
        return rows;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
}

export async function getProductMix(req, res, next) {
    try {
        let products = [];
        if (res.locals.response !== undefined && res.locals.response.products !== undefined) {
            // get the products from the previous method
            products = res.locals.response.products || [];
        }
        if (products.length === 0 && req.params.id) {
            products = [{id: req.params.id, sellAs: SELL_AS.MIX}];
        }
        for await (const prod of products) {
            if (checkSellAs(SELL_AS.MIX, prod.sellAs)) {
                const [mix] = await loadMix({productsID: prod.id});
                prod.mix = mix || null;
            }
        }
        if (res.locals.response === undefined) {
            res.locals.response = {};
        }
        res.locals.response.products = products;

    } catch (err) {
        debug("getProductMix()", err.message);
        res.locals.response.error = err.message;
    }
    next();
}

/**
 *
 * @param {Object} params
 * @param {number} [params.productId]
 * @return {Promise<Object[]>}
 */
async function loadSageBillDetail({productId}) {
    try {
        const sql = `SELECT pmd.mixDetailID                              AS id,
                            mix.mixID,
                            d.ComponentItemCode                          AS itemCode,
                            ROUND(d.QuantityPerBill * i.SalesUMConvFctr) AS itemQuantity,
                            pmd.colorsId,
                            c.color_code                                 AS colorCode,
                            c.color_name                                 AS colorName
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.manufacturers m
                                         ON m.manufacturers_id = p.manufacturers_id
                              INNER JOIN b2b_oscommerce.products_mixes mix
                                         ON mix.productsID = p.products_id
                              LEFT JOIN c2.ci_item i
                                        ON i.Company = m.company AND i.ItemCode = mix.itemCode
                              LEFT JOIN c2.BM_BillDetail d
                                        ON d.Company = m.company AND d.BillNo = mix.itemCode
                              LEFT JOIN b2b_oscommerce.products_mixes_detail pmd
                                        ON pmd.mixID = mix.mixID AND pmd.itemCode = d.ComponentItemCode
                              LEFT JOIN b2b_oscommerce.colors c
                                        ON c.colors_id = pmd.colorsId
                     WHERE mix.productsID = :productId
                     ORDER BY d.LineSeqNo;`;
        const [rows] = await mysql2Pool.query(sql, {productId});
        return rows.map(row => {
            return {
                ...row,
                color: {id: row.colorsId, code: row.colorCode, name: row.colorName}
            }
        })
    } catch (err) {
        debug("loadSageBillDetail()", err.message);
        return Promise.reject(err);
    }
}


/**
 *
 * @param {Object} params
 * @param {MixDetail} params.item
 */
async function delItem({item}) {
    try {
        const {mixID, id} = item;
        const sql = `DELETE
                     FROM b2b_oscommerce.products_mixes_detail
                     WHERE mixID = :mixID
                       AND mixDetailID = :id`;
        const args = {mixID, id};
        await mysql2Pool.query(sql, args);
    } catch (err) {
        debug("delItem()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {MixDetail} params.item
 */
async function saveItem({item}) {
    try {
        if (!item.itemQuantity) {
            return delItem({item});
        }
        const {mixID, itemCode, itemQuantity, color} = item;
        const sql = `INSERT INTO b2b_oscommerce.products_mixes_detail
                         (mixID, itemCode, itemQuantity, colorsId)
                     VALUES (:mixID, :itemCode, :itemQuantity, :colorsId)
                     ON DUPLICATE KEY UPDATE itemQuantity = :itemQuantity,
                                             colorsId     = :colorsId`;
        const args = {mixID, itemCode, itemQuantity, colorsId: color.id};
        await mysql2Pool.query(sql, args);
    } catch (err) {
        debug("saveItem()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {Mix} params.mix
 */
async function saveNewMix({mix}) {
    try {
        const {productId, itemCode, mixName, status} = mix;
        const sql = `INSERT INTO b2b_oscommerce.products_mixes
                         (productsID, itemCode, mixName, active)
                     VALUES (:productID, :itemCode, :mixName, :active)`;
        const args = {productId, itemCode, mixName, active: status};
        const [result] = await mysql2Pool.query(sql, args);
        return result;
    } catch (err) {
        debug("saveNewMix()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {Mix} params.mix
 */

async function saveMix({mix}) {
    try {
        if (!mix.id || mix.id === '0') {
            return saveNewMix({mix});
        }
        const {id, itemCode, mixName, status} = mix;
        const sql = `UPDATE b2b_oscommerce.products_mixes
                     SET itemCode = :itemCode,
                         mixName  = :mixName,
                         active   = :active
                     WHERE mixID = :id`;
        const args = {id, itemCode, mixName, active: status};
        const [result] = await mysql2Pool.query(sql, args);
        return result;
    } catch (err) {
        debug("saveMix()", err.message);
        return Promise.reject(err);
    }
}

async function getMix(req, res, next) {
    try {
        const [mix] = await loadMix({productsID: res.params.productId});
        res.locals.response = {mix};
        next();
    } catch (err) {
        debug("get()", err.message);
        res.json({error: err.message});
    }
}

async function postMix(req, res, next) {
    try {
        await saveMix({mix: req.body});
        next();
    } catch (err) {
        debug("post()", err.message);
        res.json({error: err.message});
    }
}

async function getSageBillDetail(req, res, next) {
    try {
        res.locals.response.sageBill = await loadSageBillDetail(req.params);
        next();
    } catch (err) {
        debug("getSageBillDetail()", err.message);
        res.json({error: err.message});
    }
}

async function postItems(req, res, next) {
    try {
        let items = req.body.items || [];
        if (items.length === 0) {
            items = res.locals.response.sageBill || [];
        }
        await Promise.all(items.map(item => saveItem({item})));
        next();
    } catch (err) {
        debug("postItems()", err.message);
        return Promise.reject(err);
    }
}

router.get('/:productId(\\d+)', [getMix, sendLocalsResponse]);
router.get('/sage/:productId(\\d+)', [getSageBillDetail, sendLocalsResponse]);
router.post('/:productId(\\d+)', [
    validateUser,
    validateAdmin,
    postMix,
    getSageBillDetail,
    postItems,
    getMix,
    sendLocalsResponse
]);

export default router;
