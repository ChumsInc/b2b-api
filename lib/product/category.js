import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';
import {deleteItem, loadItems, saveItem, updateItemSort} from './category-items.js';
import {findCategoryUsage, findMenuUsage, findProductUsage} from "./v2/category-items.js";

const debug = Debug('chums:lib:product:category');

export const deprecated = (req, res, next) => {
    debug('The called path is deprecated.');
    next();
};

export const loadCategories = async ({id, parentId, keyword}) => {
    const query = `SELECT categorypage_id       AS id,
                          page_title            AS title,
                          page_keyword          AS keyword,
                          page_text             AS pageText,
                          page_description_meta AS descriptionMeta,
                          parent_id             AS parentId,
                          status,
                          changefreq,
                          priority,
                          more_data             AS moreData,
                          ifnull(GREATEST(p.timestamp, (SELECT max(timestamp)
                                                        FROM b2b_oscommerce.category_pages_items
                                                        WHERE categorypage_id = p.categorypage_id)),
                                 p.timestamp)   AS timestamp
                   FROM b2b_oscommerce.category_pages p
                   WHERE (categorypage_id = :id OR :id IS NULL)
                     AND (parent_id = :parentId OR :parentId IS NULL)
                     AND (page_keyword = :keyword OR :keyword IS NULL)`;
    const data = {id, parentId, keyword};

    try {
        const [rows] = await mysql2Pool.query(query, data);
        if (rows.length === 1) {
            rows[0].children = await loadItems({parentId: rows[0].id});
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
    const {
        title, keyword, pageText = '', descriptionMeta = '', parentId = 0, status = 0,
        changefreq = 'n/a', priority = 0, lifestyle = '', css = ''
    } = body;
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
    const {
        id,
        title,
        keyword,
        pageText,
        descriptionMeta,
        parentId,
        status,
        changefreq,
        priority,
        lifestyle,
        css
    } = body;
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

export const getCategories = (req, res) => {
    loadCategories(req.params)
        .then(categories => {
            res.json({categories});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

export const postCategory = (req, res) => {
    const params = {...req.body};
    updateCategory(params)
        .then((category) => {
            res.json({category});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

export const delCategory = (req, res) => {
    let params = {...req.params};
    deleteCategory(params)
        .then(result => {
            res.json({result});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

export const getCategoryItems = (req, res) => {
    const params = {
        ...req.params
    };
    loadItems(params)
        .then(categoryItems => {
            res.json({categoryItems});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

export const postCategoryItem = (req, res) => {
    saveItem({...req.body})
        .then(item => {
            res.json({item});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

export const postItemSort = (req, res) => {
    updateItemSort({...req.params, ...req.body})
        .then(categoryItems => {
            res.json({categoryItems});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

export const deleteCategoryItem = async (req, res) => {
    try {
        await deleteItem(req.params);
        const items = await loadItems({parentId: req.params.parentId});
        res.json({items});
    } catch (err) {
        debug("deleteCategoryItem()", err.message);
        res.json({error: err.message});
    }
};

export const getUsage = async (req, res) => {
    try {
        const products = await findProductUsage(req.params.keyword);
        const categories = await findCategoryUsage(req.params.keyword);
        const menus = await findMenuUsage(req.params.keyword);
        res.json({products, categories, menus});
    } catch (err) {
        if (err instanceof Error) {
            debug("getUsage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getUsage'});
    }
}

