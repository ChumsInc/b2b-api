import Debug from 'debug';
import { deletePage, loadPage, loadPages, savePage } from "./page.js";
const debug = Debug('chums:lib:pages:index');
export const getPages = async (req, res) => {
    try {
        const params = {
            id: req.params.id,
            keyword: req.params.keyword,
            includeInactive: res.locals.profile?.roles.includes('web_admin') || res.locals.profile?.roles.includes('root'),
        };
        const pages = await loadPages(params);
        res.json({ pages });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getPages()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getPages' });
    }
};
export const getPage = async (req, res) => {
    try {
        const params = {
            keyword: req.params.keyword,
            id: req.params.id,
            includeInactive: res.locals.profile?.roles.includes('web_admin') || res.locals.profile?.roles.includes('root'),
        };
        const page = await loadPage(params);
        if (!page) {
            return res.status(404)
                .json({
                error: 'page not found',
            });
        }
        res.json({ page });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getPage()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getPage' });
    }
};
export const postPage = async (req, res) => {
    try {
        const page = await savePage(req.body);
        res.json({ page });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postPage()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postPage' });
    }
};
export const delPage = async (req, res) => {
    try {
        const params = {
            id: req.params.id,
            includeInactive: res.locals.profile?.roles.includes('web_admin') || res.locals.profile?.roles.includes('root'),
        };
        const [page] = await loadPages(params);
        if (!page) {
            return res.status(404).json({ error: 'page not found' });
        }
        const pages = await deletePage({ id: page.id });
        res.json({ pages });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delPage()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in delPage' });
    }
};
