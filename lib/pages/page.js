import Debug from "debug";
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:pages:pages');
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
    status: false,
    redirectTo: 0,
    requiresLogin: false,
};
export const loadPages = async ({ id = null, keyword = null }) => {
    try {
        const query = `SELECT id,
                              keyword,
                              title,
                              meta_description AS metaDescription,
                              content,
                              filename,
                              changefreq,
                              priority,
                              more_data        AS additionalData,
                              search_words     AS searchWords,
                              status,
                              redirect_to      AS redirectTo,
                              timestamp
                       FROM b2b_oscommerce.pages
                       WHERE (IFNULL(:id, '') = '' OR id = :id)
                         AND (IFNULL(:keyword, '') = '' OR keyword = :keyword)`;
        const data = { id, keyword };
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => {
            const { more_data, status, ...rest } = row;
            const moreData = JSON.parse(row.additionalData ?? '{}');
            return {
                ...rest,
                status: status === 1,
                ...moreData,
                requiresLogin: moreData.requiresLogin === true,
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadPages()", err.message);
            return Promise.reject(err);
        }
        debug("loadPages()", err);
        return Promise.reject(new Error('Error in loadPages()'));
    }
};
export async function loadPage({ id, keyword }) {
    try {
        if (!keyword && !id) {
            return null;
        }
        const [page] = await loadPages({ keyword, id });
        return page ?? null;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadPage()", err.message);
            return Promise.reject(err);
        }
        debug("loadPage()", err);
        return Promise.reject(new Error('Error in loadPage()'));
    }
}
export const saveNewPage = async (body) => {
    try {
        const query = `INSERT INTO b2b_oscommerce.pages
                       (keyword, title, meta_description, content, filename, changefreq, priority,
                        more_data, search_words, status)
                       VALUES (:keyword, :title, :metaDescription, :content, :filename, :changefreq, :priority,
                               :more_data, :searchWords, :status)`;
        const more_data = {
            lifestyle: body.lifestyle,
            css: body.css,
            subtitle: body.subtitle,
            requiresLogin: body.requiresLogin,
        };
        const data = {
            ...DEFAULT_PAGE,
            ...body,
            more_data: JSON.stringify(more_data)
        };
        const [{ insertId }] = await mysql2Pool.query(query, data);
        const [page] = await loadPages({ id: insertId });
        return page;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveNewPage()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewPage()", err);
        return Promise.reject(new Error('Error in saveNewPage()'));
    }
};
export const savePage = async (body) => {
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
                           status           = :status,
                           redirect_to      = :redirectTo
                       WHERE id = :id`;
        const more_data = {
            lifestyle: body.lifestyle ?? '',
            css: body.css ?? '',
            subtitle: body.subtitle ?? '',
            requiresLogin: body.requiresLogin ?? false,
        };
        const data = {
            ...DEFAULT_PAGE,
            ...body,
            id: body.id,
            more_data: JSON.stringify(more_data)
        };
        await mysql2Pool.query(query, data);
        const [page] = await loadPages({ id: body.id });
        return page;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("savePage()", err.message);
            return Promise.reject(err);
        }
        debug("savePage()", err);
        return Promise.reject(new Error('Error in savePage()'));
    }
};
export const deletePage = async ({ id }) => {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.pages
                       WHERE id = :id`;
        const data = { id };
        await mysql2Pool.query(query, data);
        return await loadPages({});
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deletePage()", err.message);
            return Promise.reject(err);
        }
        debug("deletePage()", err);
        return Promise.reject(new Error('Error in deletePage()'));
    }
};
