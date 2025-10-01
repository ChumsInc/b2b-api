import Debug from 'debug';
import {Request, Response} from 'express'
import {deletePage, loadPage, loadPages, savePage} from "./page.js";

const debug = Debug('chums:lib:pages:index');

export const getPages = async (req: Request, res: Response) => {
    try {
        const pages = await loadPages(req.params);
        res.json({pages});
    } catch (err) {
        if (err instanceof Error) {
            debug("getPages()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPages'});
    }
};

export const getPage = async (req: Request, res: Response) => {
    try {
        const params = {
            keyword: req.params.keyword,
            id: req.params.id,
        }
        const page = await loadPage(params);
        if (!page) {
            return res.status(404)
                .json({
                    error: 'page not found',
                })
        }
        res.json({page});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getPage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPage'});
    }
}

export const postPage = async (req: Request, res: Response) => {
    try {
        const page = await savePage(req.body);
        res.json({page});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("postPage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postPage'});
    }
};

export const delPage = async (req: Request, res: Response) => {
    try {
        const params = {
            id: req.params.id,
        }
        const [page] = await loadPages(params);
        if (!page) {
            return res.status(404).json({error: 'page not found'});
        }
        const pages = await deletePage({id: page.id});
        res.json({pages});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("delPage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delPage'});
    }
};
