/**
 * Created by steve on 5/31/2016.
 */


const debug = require('debug')('chums:lib:product:v2:category-items');
const {mysql2Pool} = require('chums-local-modules');
const Product = require('./product');
const Category = require('./category');


async function loadComponents(row) {
    try {
        const params = {};
        if (row.productsId) {
            params.id = row.productsId;
            row.product = await Product.load(params) || {};
            row.category = {};
            row.keyword = row.product.keyword || '';
            return row;
        } else if (row.categoriesId) {
            params.id = row.categoriesId;
            const [category = {}] = await Category.loadCategories(params);
            row.category = category;
            row.product = {};
            row.keyword = category.keyword;
            return row;
        } else {
            return row;
        }
    } catch (err) {
        debug("loadComponents()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param params
 * @param {number?} [params.id]
 * @param {number?} [params.parentId]
 * @returns {Promise}
 */
async function loadItems({id = null, parentId = null}) {
    const query = `SELECT item_id             AS id,
                          categorypage_id     AS parentId,
                          itemType,
                          section_title       AS sectionTitle,
                          section_description AS sectionDescription,
                          item_title          AS title,
                          item_text           AS description,
                          item_url            AS urlOverride,
                          item_class          AS className,
                          item_image_url      AS imageUrl,
                          products_id         AS productsId,
                          categories_id       AS categoriesId,
                          priority,
                          status,
                          timestamp
                   FROM b2b_oscommerce.category_pages_items
                   WHERE item_id = :id
                      OR categorypage_id = :parentId`;
    const data = {id, parentId};

    try {
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        await Promise.all(rows.map(row => loadComponents(row)));
        return rows;
    } catch (err) {
        debug("loadItems()", err.message);
    }
}

/**
 *
 * @param params
 * @returns {Promise<*>}
 */
async function saveItem(params = {}) {
    try {
        const id = !!params.id ? Number(params.id) : 0;
        const {parentId} = params;
        const queryAdd = `INSERT INTO b2b_oscommerce.category_pages_items (categories_id)
                          VALUES (:parentId)`;
        const query = `UPDATE b2b_oscommerce.category_pages_items
                       SET itemType            = :itemType,
                           section_title       = :sectionTitle,
                           section_description = :sectionDescription,
                           item_title          = :title,
                           item_text           = : description,
                           item_url            = :urlOverride,
                           item_class          = :className,
                           item_image_url      = :imageUrl,
                           products_id         = :productsId,
                           categories_id       = :categoriesId,
                           priority            = :priority,
                           status              = :status
                       where item_id = :id`;
        const data = {...params, parentId, id};
        const connection = await mysql2Pool.getConnection();
        if (data.id === 0) {
            const [{insertId}] = await connection.query(queryAdd, data);
            data.id = insertId;
        }
        await connection.query(query, data);
        connection.release();
        return await loadItems({id, parentId});
    } catch (err) {
        debug("saveItem()", err.message);
        return err;
    }
}

async function updateItemSort({parentId, items = []}) {
    try {
        const query = `UPDATE b2b_oscommerce.category_pages_items SET priority = :priority WHERE item_id = :id`;
        const connection = await mysql2Pool.getConnection();
        await Promise.all(items.map(item => {
            const data = {...item};
            return connection.query(query, data);
        }));
        connection.release();
        return await loadItems({parentId});
    } catch (err) {
        debug("updateItemSort()", err.message);
        return Promise.reject(err);
    }
}



async function deleteItem({id, parentId}) {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.category_pages_items
                       where item_id = :id
                         and categorypage_id = :parentId`;
        const data = {id, parentId};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadItems({parentId});
    } catch (err) {
        debug("deleteItem()", err.message);
    }
}

exports.loadItems = loadItems;
exports.saveItem = saveItem;
exports.deleteItem = deleteItem;
exports.updateItemSort = updateItemSort;
