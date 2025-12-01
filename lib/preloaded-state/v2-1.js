import { buildPreloadedState } from "./v2.js";
import _debug from 'debug';
import { consentCookieName } from "cookie-consent";
const debug = _debug('chums:lib:preloaded-state:v2-1');
export async function buildPreloadedStateV2a({ keyword, uuid, sku }) {
    try {
        const state = await buildPreloadedState({ keyword, uuid, sku });
        return {
            ...state,
            banners: updateBannersState(state.banners?.list ?? [])
        };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("buildPreloadedStateV2a()", err.message);
            return Promise.reject(err);
        }
        debug("buildPreloadedStateV2a()", err);
        return Promise.reject(new Error('Error in buildPreloadedStateV2a()'));
    }
}
function updateBannersState(banners) {
    const entities = {};
    const ids = [];
    banners.forEach(banner => {
        entities[banner.id] = banner;
        ids.push(banner.id);
    });
    return {
        entities,
        ids,
        status: 'idle',
        updated: Date.now()
    };
}
export const getPreloadedStateV2a = async (req, res) => {
    try {
        const params = {
            keyword: req.query.keyword ?? null,
            uuid: req.query.uuid ?? req.signedCookies[consentCookieName] ?? res.locals.uuid ?? null,
            sku: req.query.sku ?? null,
        };
        const state = await buildPreloadedStateV2a(params);
        res.json(state);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getPreloadedStateV2a()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getPreloadedStateV2a' });
    }
};
export const renderPreloadedStateV2a = async (req, res) => {
    try {
        const params = {
            keyword: req.query.keyword ?? null,
            uuid: req.query.uuid ?? req.signedCookies[consentCookieName] ?? res.locals.uuid ?? null,
            sku: req.query.sku ?? null,
        };
        const state = await buildPreloadedStateV2a(params);
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify(state, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderPreloadedStateV2a()", err.message);
        }
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify({}, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    }
};
