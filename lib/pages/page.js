import Debug from "debug";
import {mysql2Pool} from "chums-local-modules";

const debug = Debug('chums:lib:menus:menu');


const DEFAULT_PAGE = {
    id: 0,
    keyword: '',
    title: '',
    metaDescription: '',
    content: '',
    filename: '',
    changefreq: '',
    priority: 0.5,
    more_data: {},
    searchWords: '',
    status: 0,
};

const loadPages = async ({id = null, keyword = null}) => {
    try {
        const query = `SELECT id,
                              keyword,
                              title,
                              meta_description AS metaDescription,
                              content,
                              filename,
                              changefreq,
                              priority,
                              more_data,
                              search_words     AS searchWords,
                              status,
                              timestamp
                       FROM b2b_oscommerce.pages
                       WHERE (id = :id OR :id IS NULL)
                         AND (keyword = :keyword OR :keyword IS NULL)`;
        const data = {id, keyword};
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => {
            const moreData = JSON.parse(row.more_data || '{}');
            delete row.more_data;
            return {
                ...row,
                moreData,
                ...moreData
            };
        });
    } catch (err) {
        debug("loadPages()", err.message);
        return Promise.reject(err);
    }
};

export const loadPage = async ({keyword}) => {
    try {
        if (!keyword) {
            return null;
        }
        const [page] = await loadPages({keyword});
        return page ?? null;
    } catch(err) {
        if (err instanceof Error) {
            console.debug("loadPage()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadPage()", err);
        return Promise.reject(new Error('Error in loadPage()'));
    }
}

const saveNewPage = async (body) => {
    try {
        const query = `INSERT INTO b2b_oscommerce.pages
                       (keyword, title, meta_description, content, filename, changefreq, priority,
                        more_data, search_words, status)
                       VALUES (keyword, :title, :metaDescription, :content, :filename, :changefreq, :priority,
                               :more_data, :searchWords, :status)`;
        const more_data = {
            lifestyle: body.lifestyle,
            css: body.css,
            subtitle: body.subtitle,
        };
        const data = {...DEFAULT_PAGE, ...body, more_data: JSON.stringify(more_data)};
        const [{insertId}] = await mysql2Pool.query(query, data);
        const [page] = await loadPages({id: insertId});
        return page;
    } catch (err) {
        debug("saveNewPage()", err.message);
        return Promise.reject(err);
    }

};

const savePage = async (body) => {
    try {
        if (!body.id) {
            return saveNewPage(body);
        }
        const query = `UPDATE b2b_oscommerce.pages
                       SET keyword          = :keyword,
                           title            = :title,
                           meta_description = :metaDescription,
                           content          = :content,
                           filename         = :filename,
                           changefreq       = :changefreq,
                           priority         = :priority,
                           more_data        = :more_data,
                           search_words     = :searchWords,
                           status           = :status
                       WHERE id = :id`;
        const more_data = {
            lifestyle: body.lifestyle,
            css: body.css,
            subtitle: body.subtitle,
        };
        const data = {...DEFAULT_PAGE, ...body, more_data: JSON.stringify(more_data)};
        await mysql2Pool.query(query, data);
        const [page] = await loadPages({id: body.id});
        return page;
    } catch (err) {
        debug("savePage()", err.message);
        return Promise.reject(err);
    }
};

const deletePage = async ({id}) => {
    try {
        const query = `DELETE FROM b2b_oscommerce.pages WHERE id = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
        return await loadPages({});
    } catch (err) {
        debug("deleteMenu()", err.message);
        return Promise.reject(err);
    }
};

export const getPages = (req, res) => {
    loadPages(req.params)
        .then(pages => {
            res.json({pages});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};


export const postPage = (req, res) => {
    savePage(req.body)
        .then(page => {
            res.json({page});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

export const delPage = (req, res) => {
    deletePage(req.params)
        .then(pages => {
            res.json({pages});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};
