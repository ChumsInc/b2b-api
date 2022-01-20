"use strict";

const debug = require('debug')('chums:lib:product:v2:category');
const {mysql2Pool} = require('chums-local-modules');
const {loadItems, saveItem, deleteItem, updateItemSort} = require('./category-items');

const loadCategories = async ({id = null, parentId = null, keyword = null}) => {
    let query = `SELECT categorypage_id       AS id,
                        page_title            AS title,
                        page_keyword          AS keyword,
                        page_text             AS pageText,
                        page_description_meta AS descriptionMeta,
                        parent_id             AS parentId,
                        status,
                        changefreq,
                        priority,
                        more_data,
                        timestamp
                 FROM b2b_oscommerce.category_pages
                 WHERE (categorypage_id = :id and not isnull( :id))
                    OR (parent_id = :parent_id and not isnull(:parent_id))
                    OR (page_keyword = :keyword and not isnull(:keyword))`,
        data = {id, parentId, keyword};
    try {
        const [rows] = await mysql2Pool.query(query, data);
        rows.map(row => {
            row.more_data = JSON.parse(row.more_data || '{}');
        });
        return rows;
    } catch (err) {
        debug('loadCategories() err', err.message);
        return Promise.reject(err);
    }
};

const loadCategory = async ({keyword, id}) => {
    try {
        const query = `SELECT categorypage_id       AS id,
                              page_title            AS title,
                              page_keyword          AS keyword,
                              page_text             AS pageText,
                              page_description_meta AS descriptionMeta,
                              parent_id             AS parentId,
                              status,
                              changefreq,
                              priority,
                              more_data,
                              timestamp
                       FROM b2b_oscommerce.category_pages
                       WHERE page_keyword = :keyword
                          OR categorypage_id = :id`;
        const [[category]] = await mysql2Pool.query(query, {keyword, id});
        if (!category) {
            return category;
        }
        category.more_data = JSON.parse(category.more_data || '{}');
        category.children = await loadItems({parentId: category.id});
        return category;
    } catch (err) {
        debug("loadCategory()", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.keyword
 * @param {string} params.pageText
 * @param {string} params.descriptionMeta
 * @param {number} params.parentId
 * @param {number} params.status
 * @param {string} params.changefreq
 * @param {number} params.priority
 * @param {object} params.more_data
 * @return Promise
 */
async function addCategory(params) {
    try {
        const query = `INSERT INTO b2b_oscommerce.category_pages
                       (page_title, page_keyword, page_text, page_description_meta, parent_id, status, changefreq,
                        priority, more_data)
                       VALUES (:title, :keyword, :pageText, :descriptionMeta, :parentId, :status, :changefreq,
                               :priority, :more_data)`;
        const data = {...params, more_data: JSON.stringify(params.more_data || {})};
        const [{insertId}] = await mysql2Pool.query(query, data);
        return await loadCategory({id: insertId});
    } catch (err) {
        debug('addCategory() err', err.message);
        return err;
    }
}

/**
 *
 * @param {Object} params
 * @param {number} params.id
 * @param {string} params.title
 * @param {string} params.keyword
 * @param {string} params.pageText
 * @param {string} params.descriptionMeta
 * @param {number} params.parentId
 * @param {number} params.status
 * @param {string} params.changefreq
 * @param {number} params.priority
 * @param {object} params.more_data
 * @returns Promise
 */
async function updateCategory(params) {
    try {
        if (!params.id || Number(params.id) === 0) {
            return addCategory(params);
        }
        const query = `UPDATE b2b_oscommerce.category_pages
                       SET page_title            = :title,
                           page_keyword          = :keyword,
                           page_text             = :pageText,
                           page_description_meta = :descriptionMeta,
                           parent_id             = :parentId,
                           status                = :status,
                           changefreq            = :changefreq,
                           priority              = :priority
                       WHERE categorypage_id = :id`;
        const data = {...params};
        await mysql2Pool.query(query, data);
    } catch (err) {
        debug("updateCategory()", params, err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {number} id
 * @returns Promise
 */
async function deleteCategory({id}) {
    try {
        const items = await loadItems({parentId: id});
        if (items.length) {
            return new Error('Cannot delete category while items exist');
        }
        const query = `DELETE
                   FROM b2b_oscommerce.category_pages
                   WHERE categorypage_id = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
        return await loadCategories({});
    } catch(err) {
        debug("deleteCategory()", err.message);
        return Promise.reject(err);
    }
}

exports.getCategory = async (req, res) => {
    try {
        const category = await loadCategory(req.params);
        res.json({categories: [category]});
    } catch(err) {
        debug("getCategory()", err.message);
        res.json({error: err.message});
    }
};

exports.getCategories = async (req, res) => {
    try {
        const categories = await loadCategories(req.params);
        res.json({categories});
    } catch (err) {
        debug("getCategories()", err.message);
        res.json({error: err.message});
    }
};

exports.getCategoryItems = async (req, res) => {
    try {
        const items = await categoryItems.loadItems(req.params);
        res.json({categoryItems: items});
    } catch(err) {
        debug("getCategoryItems()", err.message);
        res.json({error: err.message});
    }
};

exports.postCategory = async (req, res) => {
    try {
        const category = updateCategory(req.body);
        res.json({categories: [category]});
    } catch (err) {
        debug("postCategory()", err.message);
        res.json({error: err.message});
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const categories = await deleteCategory(req.params);
        res.json({categories});
    } catch (err) {
        debug("deleteCategory()", err.message);
        res.json({error: err.message});
    }
};

exports.postCategoryItem = async (req, res) => {
    try {
        const items = await saveItem(req.body);
        res.json({items});
    } catch (err) {
        debug("postCategoryItem()", err.message);
        res.json({error: err.message});
    }
};

exports.postItemSort = async (req, res) => {
    try {
        const items = await updateItemSort({...req.params, items: req.body});
        res.json({items});
    } catch (err) {
        debug("postItemSort()", err.message);
    }
};

exports.deleteCategoryItem = async (req, res) => {
    try {
        const items = await deleteItem(req.params);
        res.json({items});
    } catch (err) {
        debug("deleteCategoryItem()", err.message);
    }
}
