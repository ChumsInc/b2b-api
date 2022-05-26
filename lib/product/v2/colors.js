"use strict";

const debug = require('debug')('chums:lib:product:v2:colors');
const {mysql2Pool} = require('chums-local-modules');

/**
 *
 * @param {Number|String|null} id
 * @param {String|null} code
 * @return {Promise<*>}
 */
async function loadColors({id = null, code = null} = {}) {
    try {
        const query = `SELECT colors_id  AS id,
                              color_code AS code,
                              color_name AS name
                       FROM b2b_oscommerce.colors
                       WHERE (colors_id = :id OR ISNULL(:id))
                         AND (color_code = :code OR ISNULL(:code))
                       ORDER BY code`;
        const data = {id};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("load()", err.message);
        return err
    }
}

/**
 *
 * @param {String|Number} id
 * @param {String} code
 * @param {String} name
 * @return {Promise<Error|*>}
 */
async function saveColor({id, code, name}) {
    try {
        const colors = await loadColors();
        const [color] = colors.filter(color => color.code === code);
        if (color && color.id !== Number(id)) {
            return new Error(`Color code '${code}' already exists`);
        }
        const queryInsert = `INSERT INTO b2b_oscommerce.colors (color_code, color_name)
                             VALUES (:code, :name)`;
        const queryUpdate = `UPDATE b2b_oscommerce.colors
                             SET color_code = :code,
                                 color_name = :name
                             WHERE colors_id = :id`;
        const data = {id, code, name};


        if (!id || id === "0") {
            const [{insertId}] = await mysql2Pool.query(queryInsert, data);
            id = insertId;
        } else {
            await mysql2Pool.query(queryUpdate, data);
        }

        return await loadColors({id});
    } catch (err) {
        debug("saveColor()", err.message);
        return err;
    }
}

async function loadColorUsage({id}) {
    try {
        const query = `SELECT p.products_id      AS productId,
                              p.products_keyword AS keyword,
                              d.products_name    AS name,
                              i.itemCode,
                              IF(
                                          i.active
                                          AND p.products_status
                                          AND IFNULL(ci.ItemCode, 0)
                                          AND IFNULL(ci.ProductType, 'D') <> 'D'
                                          AND IFNULL(ci.InactiveItem, 'Y') <> 'Y'
                                  , 1, 0
                                  )              AS status,
                              p.products_image   AS image
                       FROM b2b_oscommerce.products p
                            INNER JOIN b2b_oscommerce.manufacturers m
                                       ON m.manufacturers_id = p.manufacturers_id
                            INNER JOIN b2b_oscommerce.products_description d
                                       ON d.products_id = p.products_id AND d.language_id = 1
                            INNER JOIN b2b_oscommerce.products_items i
                                       ON i.productsID = p.products_id
                            LEFT JOIN c2.ci_item ci
                                      ON ci.company = m.company AND ci.ItemCode = i.itemCode
                       WHERE i.colorsID = :id
                       ORDER BY i.itemCode `;
        const data = {id};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadColorUsage()", err.message);
        return err;
    }
}

async function loadMixUsage({id}) {
    try {
        const query = `SELECT p.products_id      AS productId,
                              p.products_keyword AS keyword,
                              m.itemCode,
                              IF(
                                          p.products_status
                                          AND IFNULL(ci.ItemCode, 0)
                                          AND IFNULL(ci.ProductType, 'D') <> 'D'
                                          AND IFNULL(ci.InactiveItem, 'Y') <> 'Y'
                                  , 1, 0
                                  )              AS status,
                              md.itemQuantity,
                              p.products_image   AS image
                       FROM b2b_oscommerce.products p
                            INNER JOIN b2b_oscommerce.manufacturers mfg
                                       ON mfg.manufacturers_id = p.manufacturers_id
                            INNER JOIN b2b_oscommerce.products_mixes m
                                       ON m.productsID = p.products_id
                            INNER JOIN b2b_oscommerce.products_mixes_detail md
                                       ON md.mixID = m.mixID
                            LEFT JOIN c2.ci_item ci
                                      ON ci.Company = mfg.Company AND ci.ItemCode = m.itemCode
                       WHERE md.colorsID = :id
                       ORDER BY m.itemCode`;
        const data = {id};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadMixUsage()", err.message);
        return err;
    }
}

exports.getColors = async (req, res) => {
    try {
        const colors = await loadColors(req.params);
        res.json({colors});
    } catch (err) {
        debug("getColors()", err.message);
        res.json({error: err.message});
    }
};

exports.getItems = async (req, res) => {
    try {
        const items = await loadColorUsage(req.params);
        res.json({items});
    } catch (err) {
        debug("getItems()", err.message);
        res.json({error: err.message});
    }
};

exports.getMixItems = async (req, res) => {
    try {
        const items = await loadMixUsage(req.params);
        res.json({items});
    } catch (err) {
        debug("getMixItems()", err.message);
        res.json({error: err.message});
    }
};

exports.postColor = async (req, res) => {
    try {
        const color = await saveColor(req.body);
        res.json({color});
    } catch (err) {
        debug("postColor()", err.message);
        res.json({error: err.message});
    }
};
