"use strict";

const debug = require('debug')('chums:lib:product:category');
const {mysql2Pool} = require('chums-local-modules');
const categoryItems = require('./category-items');

const deprecated = (req, res, next) => {
    debug('The called path is deprecated.');
    next();
};

const loadCategories = async ({id, parentId, keyword}) => {
    const query = `SELECT categorypage_id       AS id,
                          page_title            AS title,
                          page_keyword          AS keyword,
                          page_text             AS pageText,
                          page_description_meta AS descriptionMeta,
                          parent_id             AS parentId,
                          status,
                          changefreq,
                          priority,
                          more_data as moreData,
                          timestamp
                   FROM b2b_oscommerce.category_pages
                   WHERE (categorypage_id = :id OR :id IS NULL)
                     AND (parent_id = :parentId OR :parentId IS NULL)
                     AND (page_keyword = :keyword OR :keyword IS NULL)`;
    const data = {id, parentId, keyword};

    try {
        const [rows] = await mysql2Pool.query(query, data);
        if (rows.length === 1) {
            rows[0].children = await categoryItems.loadItems({parentId: rows[0].id});
        }
        return rows.map(row => {
            const moreData = JSON.parse(row.moreData || '{}');
            delete row.moreData;
            return {...row, ...moreData};
        });
    } catch (err) {
        debug('loadCategories() err', err.message);
        return Promise.reject(err);
    }
};

async function addCategory({...body}) {
    const {title, keyword, pageText = '', descriptionMeta = '', parentId = 0, status = 0,
        changefreq = 'n/a', priority = 0, lifestyle = '', css = ''} = body;
    let query = `INSERT INTO b2b_oscommerce.category_pages
                 (page_title, page_keyword, page_text, page_description_meta, parent_id, status, changefreq, priority,
                  more_data)
                 VALUES (:title, :keyword, :pageText, :descriptionMeta, :parentId, :status, :changefreq, :priority,
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
        moreData: JSON.stringify({lifestyle, css}),
    };

    try {
        const [{insertId}] = await mysql2Pool.query(query, data);
        const [category] = await loadCategories({id: insertId});
        return category;
    } catch (err) {
        debug('addCategory() err', err.message);
        return Promise.reject(err);
    }
}

async function updateCategory({...body}) {
    if (!body.id) {
        return addCategory({...body});
    }
    const {id, title, keyword, pageText, descriptionMeta, parentId, status, changefreq, priority, lifestyle, css} = body;
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
        moreData: JSON.stringify({lifestyle, css}),
        id,
    };
    try {
        await mysql2Pool.query(query, data);
        const [category] = await loadCategories({id});
        return category;
    } catch (err) {
        debug("updateCategory()", params, err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {number} params.id
 * @returns Promise
 */
async function deleteCategory({id}) {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.category_pages
                       WHERE categorypage_id = :id`;
        const data = {id};

        const [result] = await mysql2Pool.query(query, data);
        return result;

    } catch (err) {
        debug("deleteCategory()", err.message);
        return Promise.reject(err);
    }
}

const getCategories = (req, res) => {
    loadCategories(req.params)
        .then(categories => {
            res.json({categories});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

const postCategory = (req, res) => {
    const params = {...req.body};
    updateCategory(params)
        .then((category) => {
            res.json({category});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

const delCategory = (req, res) => {
    let params = {...req.params};
    deleteCategory(params)
        .then(result => {
            res.json({result});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

const getCategoryItems = (req, res) => {
    const params = {
        ...req.params
    };
    categoryItems.loadItems(params)
        .then(categoryItems => {
            res.json({categoryItems});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

const postCategoryItem = (req, res) => {
    categoryItems.saveItem({...req.body})
        .then(item => {
            res.json({item});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

const postItemSort = (req, res) => {
    categoryItems.updateItemSort({...req.params, ...req.body})
        .then(categoryItems => {
            res.json({categoryItems});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

const deleteCategoryItem = async (req, res) => {
    try {
        await categoryItems.deleteItem(req.params);
        const items = await categoryItems.loadItems({parentId: req.params.parentId});
        res.json({items});
    } catch(err) {
        debug("deleteCategoryItem()", err.message);
        res.json({error: err.message});
    }
};

exports.loadCategories = loadCategories;
exports.getCategories = getCategories;
exports.deprecated = deprecated;
exports.postCategory = postCategory;
exports.delCategory = delCategory;

exports.getCategoryItems = getCategoryItems;
exports.postCategoryItem = postCategoryItem;
exports.deleteCategoryItem = deleteCategoryItem;
exports.postItemSort = postItemSort;

