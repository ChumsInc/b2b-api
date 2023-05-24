import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:product:v2:item');
import { loadSeasons } from './seasons.js';
export async function loadProductItems({ id, productId, productIdList = [0] }) {
    try {
        if (productId) {
            productIdList.push(productId);
        }
        // debug('loadItems()', {id, productIdList});
        const query = `SELECT i.id,
                              i.productsID                    AS productId,
                              i.colorsID                      AS colorsId,
                              i.colorCode,
                              i.itemCode,
                              c.color_name                    AS colorName,
                              i.active                        AS status,
                              ci.SuggestedRetailPrice         AS msrp,
                              ci.StandardUnitPrice            AS stdPrice,
                              ci.PriceCode                    AS priceCode,
                              ci.StandardUnitOfMeasure        AS stdUM,
                              ci.SalesUnitOfMeasure           AS salesUM,
                              ci.SalesUMConvFctr              AS salesUMFactor,
                              ci.ShipWeight                   AS shipWeight,
                              ci.ProductType                  AS productType,
                              w.QuantityAvailable,
                              if(ci.InactiveItem = 'Y', 1, 0) AS inactiveItem,
                              w.buffer,
                              ci.UDF_UPC                      AS upc,
                              ifnull(i.additionalData, '{}')  AS additionalData,
                              i.timestamp,
                              ia.ItemStatus as productStatus
                       FROM b2b_oscommerce.products_items i
                                INNER JOIN b2b_oscommerce.products p
                                           ON p.products_id = i.productsID
                                LEFT JOIN b2b_oscommerce.manufacturers m
                                          ON p.manufacturers_id = m.manufacturers_id
                                LEFT JOIN b2b_oscommerce.colors c
                                          ON c.colors_id = i.colorsID
                                LEFT JOIN c2.ci_item ci
                                          ON ci.Company = m.company AND ci.ItemCode = i.itemCode
                                LEFT JOIN c2.v_web_available w
                                          ON w.Company = ci.company AND w.ItemCode = ci.ItemCode AND
                                             w.WarehouseCode = ci.DefaultWarehouseCode
                                LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                          ON ia.company = ci.company
                                              AND ia.ItemCode = ci.ItemCode
                                              AND ia.WarehouseCode = ci.DefaultWarehouseCode
                       WHERE (p.products_id IN (:productIdList) OR i.id = :id)
                       ORDER BY i.ItemCode`;
        const data = { id, productIdList };
        const [rows] = await mysql2Pool.query(query, data);
        const seasons = await loadSeasons({});
        return rows.map(row => {
            let additionalData = {};
            try {
                additionalData = JSON.parse(row.additionalData);
            }
            catch (err) { }
            if (additionalData.season_id) {
                const [season] = seasons.filter(s => s.product_season_id === additionalData.season_id);
                if (season.active) {
                    additionalData.season = season;
                }
            }
            return {
                ...row,
                inactiveItem: row.inactiveItem === 1,
                status: !!row.status && !(!row.productType || row.productType === 'D' || row.inactiveItem === 1),
                additionalData,
                QuantityAvailable: Number(row.QuantityAvailable),
                color: { id: row.colorsId, code: row.colorCode, name: row.colorName, swatchCode: additionalData.swatch_code || null },
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadProductItems()", err.message);
            return Promise.reject(err);
        }
        debug("loadProductItems()", err);
        return Promise.reject(new Error('Error in loadItems()'));
    }
}
async function saveNewProductItem({ productId, colorsId }) {
    try {
        const query = `INSERT IGNORE INTO b2b_oscommerce.products_items (productsID, colorsID, itemCode)
                       VALUES (:productId, :colorsId, '')`;
        const qId = `SELECT id
                     FROM b2b_oscommerce.products_items
                     WHERE productsID = :productId
                       AND colorsID = :colorsId`;
        const data = { productId, colorsId };
        debug('saveNewProductItem()', { productId, colorsId });
        await mysql2Pool.query(query, data);
        const [[item]] = await mysql2Pool.query(qId, data);
        return item.id;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveNewProductItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewProductItem()", err);
        return Promise.reject(new Error('Error in saveNewProductItem()'));
    }
}
async function saveProductItem({ id, productId, colorsId, colorCode, itemCode, status, additionalData }) {
    try {
        if (Number(id) === 0) {
            id = await saveNewProductItem({ productId, colorsId });
        }
        const query = `UPDATE b2b_oscommerce.products_items
                       SET colorCode      = :colorCode,
                           itemCode       = :itemCode,
                           active         = :status,
                           additionalData = :additionalData
                       WHERE id = :id`;
        const data = { id, colorCode, itemCode, status, additionalData: JSON.stringify(additionalData) };
        await mysql2Pool.query(query, data);
        return await loadProductItems({ productId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveProductItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveProductItem()", err);
        return Promise.reject(new Error('Error in saveProductItem()'));
    }
}
async function deleteProductItem({ id, productId }) {
    try {
        const query = `DELETE FROM b2b_oscommerce.products_items WHERE id = :id AND productsID = :productId`;
        const data = { id, productId };
        await mysql2Pool.query(query, data);
        return await loadProductItems({ productId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteItem()", err.message);
            return Promise.reject(err);
        }
        debug("deleteItem()", err);
        return Promise.reject(new Error('Error in deleteItem()'));
    }
}
export async function getProductItems(req, res) {
    try {
        const { productId, id } = req.params;
        const items = await loadProductItems({ id, productId });
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getItems()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getItems' });
    }
}
export async function postProductItem(req, res) {
    try {
        const items = await saveProductItem(req.body);
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postItem()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postItem' });
    }
}
export async function delProductItem(req, res) {
    try {
        const items = await deleteProductItem(req.params);
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delProductItem()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in delProductItem' });
    }
}
