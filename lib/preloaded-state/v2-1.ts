import {buildPreloadedState, BuildPreloadedStateOptions} from "./v2.js";
import {Banner, PreloadedState} from "chums-types/b2b";
import _debug from 'debug';
import {Request, Response} from "express";
import {consentCookieName, HasUUID} from "cookie-consent";

const debug = _debug('chums:lib:preloaded-state:v2-1');

export interface BannersStateV2a {
    entities: Record<number, Banner>;
    ids: number[];
    status: 'idle' | 'loading' | 'rejected';
    updated: number;
}

export interface PreloadedStateV21 extends Omit<PreloadedState, 'banners'> {
    banners?: BannersStateV2a
}

export async function buildPreloadedStateV2a({
                                                 keyword,
                                                 uuid,
                                                 sku
                                             }: BuildPreloadedStateOptions): Promise<PreloadedStateV21> {
    try {
        const state = await buildPreloadedState({keyword, uuid, sku});
        return {
            ...state,
            banners: updateBannersState(state.banners?.list ?? [])
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("buildPreloadedStateV2a()", err.message);
            return Promise.reject(err);
        }
        debug("buildPreloadedStateV2a()", err);
        return Promise.reject(new Error('Error in buildPreloadedStateV2a()'));
    }

}

function updateBannersState(banners: Banner[]): BannersStateV2a {
    const entities: BannersStateV2a['entities'] = {};
    const ids: BannersStateV2a['ids'] = [];
    banners.forEach(banner => {
        entities[banner.id] = banner;
        ids.push(banner.id);
    })
    return {
        entities,
        ids,
        status: 'idle',
        updated: Date.now()
    }
}

export const getPreloadedStateV2a = async (req: Request, res: Response<unknown, HasUUID>): Promise<void> => {
    try {
        const params: BuildPreloadedStateOptions = {
            keyword: req.query.keyword as string ?? null,
            uuid: req.query.uuid as string ?? req.signedCookies[consentCookieName] ?? res.locals.uuid ?? null,
            sku: req.query.sku as string ?? null,
        }
        const state = await buildPreloadedStateV2a(params);
        res.json(state);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getPreloadedStateV2a()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getPreloadedStateV2a'});
    }
}

export const renderPreloadedStateV2a = async (req: Request, res: Response<unknown, HasUUID>): Promise<void> => {
    try {
        const params: BuildPreloadedStateOptions = {
            keyword: req.query.keyword as string ?? null,
            uuid: req.query.uuid as string ?? req.signedCookies[consentCookieName] ?? res.locals.uuid ?? null,
            sku: req.query.sku as string ?? null,
        }
        const state = await buildPreloadedStateV2a(params);
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify(state, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("renderPreloadedStateV2a()", err.message);
        }
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify({}, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    }
}
