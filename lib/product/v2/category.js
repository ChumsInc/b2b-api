import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
import { deleteCategoryItem, loadCategoryItems, saveCategoryItem, updateCategoryItemSort } from './category-items.js';
const debug = Debug('chums:lib:product:v2:category');
export async function loadCategories({ id = null, parentId = null, keyword = null }) {
    try {
        const query = `SELECT categorypage_id                                                                         AS id,
                              page_title                                                                              AS title,
                              page_keyword                                                                            AS keyword,
                              page_text                                                                               AS pageText,
                              page_description_meta                                                                   AS descriptionMeta,
                              parent_id                                                                               AS parentId,
                              status,
                              changefreq,
                              priority,
                              JSON_EXTRACT(more_data, '$.css')                                                        AS css,
                              JSON_EXTRACT(more_data, '$.lifestyle')                                                  AS lifestyle,
                              IFNULL(GREATEST(p.timestamp, (SELECT MAX(timestamp)
                                                            FROM b2b_oscommerce.category_pages_items
                                                            WHERE categorypage_id = p.categorypage_id)),
                                     p.timestamp)                                                                     AS timestamp
                       FROM b2b_oscommerce.category_pages p
                       WHERE (IFNULL(:id, '') = '' OR categorypage_id = :id)
                         AND (IFNULL(:parent_id, '') = '' OR parent_id = :parent_id)
                         AND (IFNULL(:keyword, '') = '' OR page_keyword = :keyword)`;
        const data = { id, parentId, keyword };
        const [rows] = await mysql2Pool.query(query, data);
        if (rows.length === 1) {
            rows[0].children = await loadCategoryItems({ parentId: rows[0].id });
        }
        return rows.map(row => {
            const { children, ...rest } = row;
            return {
                ...rest,
                children: children || [],
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCategories()", err.message);
            return Promise.reject(err);
        }
        debug("loadCategories()", err);
        return Promise.reject(new Error('Error in loadCategories()'));
    }
}
export async function loadCategory({ keyword, id }) {
    try {
        const [category] = await loadCategories({ id, keyword });
        return category;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCategory()", err.message);
            return Promise.reject(err);
        }
        debug("loadCategory()", err);
        return Promise.reject(new Error('Error in loadCategory()'));
    }
}
async function addCategory(params) {
    try {
        const { title, keyword, pageText = '', descriptionMeta = '', parentId = 0, status = 0, changefreq = 'n/a', priority = 0, lifestyle = '', css = '' } = params;
        const query = `INSERT INTO b2b_oscommerce.category_pages
                       (page_title, page_keyword, page_text, page_description_meta, parent_id, status, changefreq,
                        priority,
                        more_data)
                       VALUES (:title, :keyword, :pageText, :descriptionMeta, :parentId, :status, :changefreq,
                               :priority,
                               :moreData)`;
        const data = {
            title,
            keyword,
            pageText,
            descriptionMeta,
            parentId,
            status,
            changefreq,
            priority,
            moreData: JSON.stringify({ lifestyle, css }),
        };
        const [{ insertId }] = await mysql2Pool.query(query, data);
        return await loadCategory({ id: insertId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("addCategory()", err.message);
            return Promise.reject(err);
        }
        debug("addCategory()", err);
        return Promise.reject(new Error('Error in addCategory()'));
    }
}
async function updateCategory(params) {
    try {
        if (!params.id) {
            return addCategory({ ...params });
        }
        const { id, title, keyword, pageText, descriptionMeta, parentId, status, changefreq, priority, lifestyle, css } = params;
        const query = `UPDATE b2b_oscommerce.category_pages
                       SET page_title            = :title,
                           page_keyword          = :keyword,
                           page_text             = :pageText,
                           page_description_meta = :descriptionMeta,
                           parent_id             = :parentId,
                           status                = :status,
                           changefreq            = :changefreq,
                           priority              = :priority,
                           more_data             = :moreData
                       WHERE categorypage_id = :id`;
        const data = {
            title,
            keyword,
            pageText,
            descriptionMeta,
            parentId,
            status,
            changefreq,
            priority,
            moreData: JSON.stringify({ lifestyle, css }),
            id,
        };
        await mysql2Pool.query(query, data);
        return await loadCategory({ id });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("updateCategory()", err.message);
            return Promise.reject(err);
        }
        debug("updateCategory()", err);
        return Promise.reject(new Error('Error in updateCategory()'));
    }
}
async function deleteCategory({ id }) {
    try {
        const items = await loadCategoryItems({ parentId: id });
        if (items.length) {
            return new Error('Cannot delete category while items exist');
        }
        const query = `DELETE
                       FROM b2b_oscommerce.category_pages
                       WHERE categorypage_id = :id`;
        const data = { id };
        await mysql2Pool.query(query, data);
        return await loadCategories({});
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteCategory()", err.message);
            return Promise.reject(err);
        }
        debug("deleteCategory()", err);
        return Promise.reject(new Error('Error in deleteCategory()'));
    }
}
export async function getCategory(req, res) {
    try {
        const category = await loadCategory(req.params);
        res.json({ categories: [category] });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCategory()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getCategory' });
    }
}
export async function getCategories(req, res) {
    try {
        const categories = await loadCategories(req.params);
        res.json({ categories });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCategories()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getCategories' });
    }
}
export async function getCategoryItems(req, res) {
    try {
        const items = await loadCategoryItems(req.params);
        res.json({ categoryItems: items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCategoryItems()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getCategoryItems' });
    }
}
export async function postCategory(req, res) {
    try {
        const category = updateCategory(req.body);
        res.json({ categories: [category] });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postCategory()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postCategory' });
    }
}
export async function delCategory(req, res) {
    try {
        const { id } = req.params;
        const categories = await deleteCategory({ id });
        res.json({ categories });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delCategory()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in delCategory' });
    }
}
export async function postCategoryItem(req, res) {
    try {
        const items = await saveCategoryItem(req.body);
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postCategoryItem()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postCategoryItem' });
    }
}
export async function postItemSort(req, res) {
    try {
        const params = { ...req.params, items: req.body };
        const items = await updateCategoryItemSort(params);
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postItemSort()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postItemSort' });
    }
}
export async function delCategoryItem(req, res) {
    try {
        const { id, parentId } = req.params;
        const items = await deleteCategoryItem({ id, parentId });
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteCategoryItem()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in deleteCategoryItem' });
    }
}
