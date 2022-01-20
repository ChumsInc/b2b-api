const debug = require('debug')('chums:lib:product:v2:mix');
const {mysql2Pool} = require('chums-local-modules');


/**
 *
 * @param {Number} id ProductID
 */
async function loadMix({id}) {
    try {
        const query = `SELECT mix.mixID                       AS id,
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
                              if(ci.InactiveItem = 'Y', 1, 0) AS inactiveItem,
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
                       WHERE mix.productsID = :id`;
        const queryDetail = `SELECT d.MixDetailID  AS id,
                                    m.mixID,
                                    d.ItemCode     AS itemCode,
                                    d.ItemQuantity AS itemQuantity,
                                    d.colorsId,
                                    c.color_code,
                                    c.color_name,
                                    (SELECT additionalData FROM b2b_oscommerce.products_items i
                                     WHERE i.itemCode = d.ItemCode LIMIT 1) as additionalData
                             FROM b2b_oscommerce.products_mixes m
                                      INNER JOIN b2b_oscommerce.products_mixes_detail d
                                                 ON d.mixID = m.mixID
                                      LEFT JOIN b2b_oscommerce.colors c
                                                ON c.colors_id = d.colorsId
                             WHERE m.productsID = :id
                             ORDER BY ItemCode`;
        const data = {id};
        const connection = await mysql2Pool.getConnection();
        const [[mix]] = await connection.query(query, data);
        const [detail] = await connection.query(queryDetail, data);
        connection.release();
        if (!mix) {
            return null;
        }
        detail.forEach(row => {
            const {colorsId: id, color_code: code, color_name: name} = row;
            try {
                row.additionalData = JSON.parse(row.additionalData || '{}');
            } catch(err) {}
            row.color = {id, code, name};
        });
        mix.QuantityAvailable = Number(mix.QuantityAvailable);
        mix.items = detail;
        return mix;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
}

async function loadSageBillComponents({id}) {
    try {
        const query = `SELECT pmd.mixDetailID                              AS id,
                              mix.mixID,
                              d.ComponentItemCode                          AS itemCode,
                              round(d.QuantityPerBill * i.SalesUMConvFctr) AS itemQuantity,
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
                       WHERE mix.productsID = :id
                       ORDER BY d.LineSeqNo`;
        const data = {id};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadSageBillDetail()", err.message);
        return Promise.reject(err);
    }
}

async function saveMix({productId, itemCode, mixName, status}) {
    try {
        const query = `INSERT INTO b2b_oscommerce.products_mixes (productsID, itemCode, mixName, active)
                       VALUES (:productId, :itemCode, :mixName, :active)
                       ON DUPLICATE KEY UPDATE itemCode = :itemCode,
                                               mixName  = :mixName,
                                               active   = :status`;
        const data = {productId, itemCode, mixName, status};
        await mysql2Pool.query(query, data);
        return await loadMix({id: productId});
    } catch (err) {
        debug("saveMix()", err.message);
        return Promise.reject(err);
    }
}

async function saveMixItem({id, mixID, itemCode, colorId, itemQuantity}) {
    try {
        if (itemQuantity === 0) {
            return await deleteMixItem({id, mixID});
        }
        const query = `INSERT INTO b2b_oscommerce.products_mixes_detail (mixID, itemCode, itemQuantity, colorsID)
                       VALUES (:mixID, :itemCode, :itemQuantity, :colorId)
                       ON DUPLICATE KEY UPDATE itemQuantity = :itemQuantity,
                                               colorsID     = :colorId`;
        const data = {mixID, itemCode, itemQuantity, colorId};
        await mysql2Pool.query(query, data);

    } catch (err) {
        debug("saveMixItem()", err.message);
        return Promise.reject(err);
    }
}

async function deleteMixItem({id, mixID}) {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.products_mixes_detail
                       WHERE mixDetailID = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
    } catch (err) {
        debug("deleteMixItem()", err.message);
        return Promise.reject(err);
    }
}

async function getMix(req, res) {
    try {
        const mix = await loadMix(req.params);
        res.json({mix});
    } catch (err) {
        debug("getMix()", err.message);
        res.json({error: err.message});
    }
}

async function getSageBOM(req, res) {
    try {
        const components = await loadSageBillComponents(req.params);
        res.json({components});
    } catch (err) {
        debug("getSageBOM()", err.message);
        return Promise.reject(err);
    }
}

async function postMix(req, res) {
    try {
        const params = {
            ...req.body,
        };
        const mix = await saveMix(params);
        res.json({mix});
    } catch(err) {
        debug("postMix()", err.message);
        return Promise.reject(err);
    }
}

async function postMixItems(req, res) {
    try {
        const {items = []} = req.body;
        await Promise.all(items.map(item => saveMixItem(item)));
        const mix = await loadMix(req.params);
        res.json({mix});
    } catch(err) {
        debug("postMixItems()", err.message);
        return Promise.reject(err);
    }
}

exports.getMix = getMix;
exports.getSageBOM = getSageBOM;
exports.loadMix = loadMix;
exports.postMix = postMix;
exports.postMixItems = postMixItems;
