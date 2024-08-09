import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
import { loadSeasons } from "./seasons.js";
const debug = Debug('chums:lib:product:v2:mix');
export async function loadMix(id) {
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
                              IF(ci.InactiveItem = 'Y', 1, 0) AS inactiveItem,
                              w.buffer,
                              mix.timestamp,
                              ia.ItemStatus                   AS productStatus
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
                                LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                          ON ia.company = ci.company
                                              AND ia.ItemCode = ci.ItemCode
                                              AND ia.WarehouseCode = ci.DefaultWarehouseCode
                       WHERE mix.productsID = :id`;
        const queryDetail = `SELECT d.MixDetailID  AS id,
                                    m.mixID,
                                    d.ItemCode     AS itemCode,
                                    d.ItemQuantity AS itemQuantity,
                                    d.colorsId,
                                    c.color_code,
                                    c.color_name,
                                    (SELECT additionalData
                                     FROM b2b_oscommerce.products p 
                                         INNER JOIN b2b_oscommerce.products_items i
                                            on i.productsID = p.products_id
                                     WHERE p.products_status = 1
                                       
                                         AND i.itemCode = d.ItemCode
                                     LIMIT 1)      AS additionalData
                             FROM b2b_oscommerce.products_mixes m
                                      INNER JOIN b2b_oscommerce.products_mixes_detail d
                                                 ON d.mixID = m.mixID
                                      LEFT JOIN b2b_oscommerce.colors c
                                                ON c.colors_id = d.colorsId
                             WHERE m.productsID = :id
                             ORDER BY ItemCode`;
        const data = { id };
        const [[mix]] = await mysql2Pool.query(query, data);
        const [detail] = await mysql2Pool.query(queryDetail, data);
        const seasons = await loadSeasons({});
        if (!mix) {
            return null;
        }
        mix.QuantityAvailable = Number(mix.QuantityAvailable);
        const items = detail.map(row => {
            const { colorsId: id, color_code: code, color_name: name } = row;
            let additionalData = {};
            try {
                additionalData = JSON.parse(row.additionalData || '{}');
                if (additionalData.season) {
                    const [season] = seasons.filter(s => s.product_season_id === additionalData.season?.product_season_id);
                    additionalData.season.active = season.active;
                }
            }
            catch (err) {
            }
            return {
                ...row,
                additionalData,
                color: { id, code, name },
            };
        });
        return {
            ...mix,
            inactiveItem: !!mix.inactiveItem,
            items,
            status: !!mix.status,
        };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadMix()", err.message);
            return Promise.reject(err);
        }
        debug("loadMix()", err);
        return Promise.reject(new Error('Error in loadMix()'));
    }
}
export async function loadSageBillComponents({ id }) {
    try {
        const query = `SELECT pmd.mixDetailID                              AS id,
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
                       WHERE mix.productsID = :id
                       ORDER BY d.LineSeqNo`;
        const data = { id };
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadSageBillComponents()", err.message);
            return Promise.reject(err);
        }
        debug("loadSageBillComponents()", err);
        return Promise.reject(new Error('Error in loadSageBillComponents()'));
    }
}
export async function saveMix({ productId, itemCode, mixName, status }) {
    try {
        if (!productId) {
            return Promise.reject(new Error('Product ID is required'));
        }
        const query = `INSERT INTO b2b_oscommerce.products_mixes (productsID, itemCode, mixName, active)
                       VALUES (:productId, :itemCode, :mixName, :status)
                       ON DUPLICATE KEY UPDATE itemCode = :itemCode,
                                               mixName  = :mixName,
                                               active   = :status`;
        const data = { productId, itemCode, mixName, status };
        await mysql2Pool.query(query, data);
        return await loadMix(productId);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveMix()", err.message);
            return Promise.reject(err);
        }
        debug("saveMix()", err);
        return Promise.reject(new Error('Error in saveMix()'));
    }
}
async function saveMixItem({ id, mixID, itemCode, colorsId, itemQuantity }) {
    try {
        if (itemQuantity === 0) {
            return await deleteMixItem({ id, mixID });
        }
        const query = `INSERT INTO b2b_oscommerce.products_mixes_detail (mixID, itemCode, itemQuantity, colorsID)
                       VALUES (:mixID, :itemCode, :itemQuantity, :colorsId)
                       ON DUPLICATE KEY UPDATE itemQuantity = :itemQuantity,
                                               colorsID     = :colorsId`;
        const data = { mixID, itemCode, itemQuantity, colorsId };
        await mysql2Pool.query(query, data);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveMixItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveMixItem()", err);
        return Promise.reject(new Error('Error in saveMixItem()'));
    }
}
async function deleteMixItem({ id, mixID }) {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.products_mixes_detail
                       WHERE mixDetailID = :id
                         AND mixID = :mixID`;
        const data = { id, mixID };
        await mysql2Pool.query(query, data);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteMixItem()", err.message);
            return Promise.reject(err);
        }
        debug("deleteMixItem()", err);
        return Promise.reject(new Error('Error in deleteMixItem()'));
    }
}
async function deleteMix(id) {
    try {
        const mix = await loadMix(id);
        if (mix?.items?.length) {
            return Promise.reject(new Error('Unable to delete a mix with items'));
        }
        const sql = `SELECT *
                     FROM b2b_oscommerce.products_variants
                     WHERE productID = :id`;
        const sqlDelete = `DELETE
                     FROM b2b_oscommerce.products_mixes
                     WHERE mixID = :id`;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteMix()", err.message);
            return Promise.reject(err);
        }
        debug("deleteMix()", err);
        return Promise.reject(new Error('Error in deleteMix()'));
    }
}
export async function getMix(req, res) {
    try {
        const mix = await loadMix(req.params.productId);
        res.json({ mix });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getMix()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getMix' });
    }
}
export async function getSageBOM(req, res) {
    try {
        const { id } = req.params;
        const components = await loadSageBillComponents({ id });
        res.json({ components });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getSageBOM()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getSageBOM' });
    }
}
export async function postMix(req, res) {
    try {
        const mix = await saveMix(req.body);
        res.json({ mix });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postMix()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postMix' });
    }
}
export async function postMixItems(req, res) {
    try {
        const items = req.body;
        debug('postMixItems()', items);
        await Promise.all(items.map(item => saveMixItem(item)));
        const mix = await loadMix(req.params.productId);
        res.json({ mix });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postMixItems()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postMixItems' });
    }
}
export async function delMixItem(req, res) {
    try {
        const { productId, mixID, id } = req.params;
        await deleteMixItem({ mixID, id });
        res.json({ success: true });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delMixItem()", err.message);
            return Promise.reject(err);
        }
        debug("delMixItem()", err);
        return Promise.reject(new Error('Error in delMixItem()'));
    }
}
