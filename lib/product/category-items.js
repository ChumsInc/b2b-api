/**
 * Created by steve on 5/31/2016.
 */


const debug = require('debug')('chums:lib:product:category-items');
const {mysql2Pool} = require('chums-local-modules');
const Product = require('./product');
const Category = require('./category');


async function loadComponents(row) {
    try {
        const params = {};
        if (row.productsId) {
            params.id = row.productsId;
            const result = await Product.load(params);
            row.product = result[0] || {};
            row.category = {};
            return row;
        } else if (row.categoriesId) {
            params.id = row.categoriesId;
            const result = await Category.loadCategories(params);
            row.category = result[0] || {};
            row.product = {};
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
 * @returns {Promise}
 */
async function loadItems({id, parentId, keyword}) {
    try {
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
                       WHERE (item_id = :id OR :id IS NULL)
                         AND (categorypage_id = :parentId OR :parentId IS NULL)
                         AND (:keyword IS NULL OR categorypage_id = (
                                                                    SELECT categorypage_id
                                                                    FROM b2b_oscommerce.category_pages
                                                                    WHERE page_keyword = :keyword
                                                                    LIMIT 1
                       ))
                       ORDER BY priority`;
        const data = {id, parentId, keyword};

        const [rows] = await mysql2Pool.query(query, data);
        // debug('loadItems()', data, rows);
        // return rows;
        await Promise.all(rows.map(row => loadComponents(row)));
        return rows;
    } catch (err) {
        debug("loadItems()", err.message);
    }
}

const saveNewItem = async ({...body}) => {
    try {
        const query = `INSERT INTO b2b_oscommerce.category_pages_items
                       (categorypage_id, itemType, section_title, section_description,
                        item_title, item_text, item_url, item_class,
                        item_image_url, products_id, categories_id, priority,
                        status)
                       VALUES (:parentId, :itemType, :sectionTitle, :sectionDescription, :title, :description,
                               :urlOverride, :className, :imageUrl, :productsId, :categoriesId, :priority,
                               :status)`;
        const data = {...body};

        const [{insertId}] = await mysql2Pool.query(query, data);
        const [item] = await loadItems({id: insertId});
        return item;
    } catch (err) {
        debug("saveNewItem()", err.message);
        return Promise.reject(err);
    }

};

const saveItem = async ({...body}) => {
    try {
        if (!body.id || body.id === '0') {
            return saveNewItem({...body});
        }
        const query = `UPDATE b2b_oscommerce.category_pages_items
                       SET categorypage_id     = :parentId,
                           itemType            = :itemType,
                           section_title       = :sectionTitle,
                           section_description = :sectionDescription,
                           item_title          = :title,
                           item_text           = :description,
                           item_url            = :urlOverride,
                           item_class          = :className,
                           item_image_url      = :imageUrl,
                           products_id         = :productsId,
                           categories_id       = :categoriesId,
                           priority            = :priority,
                           status              = :status
                       WHERE item_id = :id`;
        const data = {...body};

        await mysql2Pool.query(query, data);
        const [item] = await loadItems({id: body.id});
        return item;
    } catch (err) {
        debug("saveItem()", err.message);
        return Promise.reject(err);
    }
};

const deleteItem = async ({id}) => {
    try {
        const query = `DELETE FROM b2b_oscommerce.category_pages_items WHERE item_id = :id`;
        const data = {id};

        await mysql2Pool.query(query, data);
        return true;
    } catch (err) {
        debug("deleteItem()", err.message);
        return Promise.reject(err);
    }
};

const updateItemSort = async ({parentId, items = []}) => {
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
};


exports.loadItems = loadItems;
exports.saveItem = saveItem;
exports.deleteItem = deleteItem;
exports.updateItemSort = updateItemSort;
