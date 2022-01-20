const debug = require('debug')('chums:lib:product:v2:item');
const {mysql2Pool} = require('chums-local-modules');
const {loadSeasons} = require('./seasons');

async function loadItems({id, productId, productIdList = [0]}) {
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
                              i.timestamp
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
                       WHERE (p.products_id IN (:productIdList) OR i.id = :id)
                       ORDER BY i.ItemCode`;
        const data = {id, productIdList};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        const seasons = await loadSeasons({});
        rows.forEach(row => {
            row.additionalData = JSON.parse(row.additionalData || '{}');
            if (row.additionalData.season_id) {
                const [season] = seasons.filter(s => s.product_season_id === row.additionalData.season_id);
                row.additionalData.season = season;
            }
            row.QuantityAvailable = Number(row.QuantityAvailable);
            row.color = {id: row.colorsId, code: row.colorCode, name: row.colorName, swatchCode: row.additionalData.swatch_code || null};
        });
        return rows;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Number} productId
 * @param {Number} colorsId
 */
async function saveNew({productId, colorsId}) {
    try {
        const query = `INSERT IGNORE INTO b2b_oscommerce.products_items (productsID, colorsID)
                       VALUES (:productId, :colorsId)`;
        const qId = `SELECT id
                     FROM b2b_oscommerce.products_items
                     WHERE productsID = :productId
                       AND colorsID = :colorsId`;

        const data = {productId, colorsId};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        const [[item]] = await connection.query(qId, data);
        connection.release();
        return item.id;
    } catch (err) {
        debug("saveNew()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Number|string} id
 * @param {Number|string} productId
 * @param {Number|string} colorsId
 * @param {string} colorCode
 * @param {string} itemCode
 * @param {Number|boolean} active
 * @param {Object} additionalData
 */
async function save({id, productId, colorsId, colorCode, itemCode, active, additionalData}) {
    try {
        if (Number(id) === 0) {
            id = await saveNew({productId, colorsId});
        }
        const query = `UPDATE b2b_oscommerce.products_items
                       SET colorCode      = :colorCode,
                           itemCode       = :itemCode,
                           active         = :active,
                           additionalData = :additionalData
                       WHERE id = :id`;
        const data = {id, colorCode, itemCode, active, additionalData: JSON.stringify(additionalData)};
        await mysql2Pool.query(query, data);
        return await loadItems({productId});
    } catch (err) {
        debug("save()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {number|string} id
 * @param {number|string} productId
 */
async function deleteItem({id, productId}) {
    try {
        const query = `DELETE FROM b2b_oscommerce.products_items WHERE id = :id AND productsID = :productId`;
        const data = {id, productId};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadItems({productId});
    } catch (err) {
        debug("deleteItem()", err.message);
        return Promise.reject(err);
    }
}

async function getItems(req, res) {
    try {
        const {productId, id} = req.params;
        const items = await loadItems({id, productId});
        res.json({items});
    } catch (err) {
        debug("getItems()", err.message);
        res.json({error: err.message});
    }
}

async function postItem(req, res) {
    try {
        let {item, id, products_id, colors_id, item_code, color_code, image_filename, swatch_code, active, season_id} = req.body;
        if (!!season_id) {
            season_id = Number(season_id);
        }
        if (!item) {
            item = {
                id,
                productId: products_id,
                colorsId: colors_id,
                colorCode: color_code,
                itemCode: item_code,
                active: !!Number(active),
                additionalData: {
                    swatch_code,
                    image_filename,
                    season_id,
                }
            };
        }
        const items = await save(item);
        res.json({items});
    } catch (err) {
        debug("postItem()", err.message);
        res.json({error: err.message})
    }
}

async function delItem(req, res) {
    try {
        const items = await deleteItem(req.params);
        res.json({items});
    } catch (err) {
        debug("delItem()", err.message);
        res.json({error: err.message});
    }
}

exports.loadItems = loadItems;
exports.getItems = getItems;
exports.postItem = postItem;
exports.delItem = delItem;

