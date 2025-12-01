import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';
import {ProductSeason} from "chums-types/b2b";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {Request, Response} from "express";

const debug = Debug('chums:lib:product:v2:seasons');

export interface ProductSeasonRow extends Omit<ProductSeason, 'active' | 'properties' | 'product_available'>, RowDataPacket {
    active: 1 | 0,
    properties: string,
    product_available: 1 | 0,
}

export interface LoadSeasonsProps {
    id?: number,
    code?: string,
}

export async function loadSeasons({id, code}: LoadSeasonsProps): Promise<ProductSeason[]> {
    try {
        const query = `SELECT product_season_id,
                              ps.code,
                              ps.description,
                              product_available,
                              product_teaser,
                              ps.active,
                              JSON_EXTRACT(IFNULL(pms.properties, '{}'), '$') AS properties,
                              ps.preseason_message as preSeasonMessage,
                              timestamp
                       FROM b2b_oscommerce.product_seasons ps
                                LEFT JOIN c2.PM_Seasons pms
                                          ON pms.code = ps.code
                       WHERE (IFNULL(:id, 0) = 0 OR product_season_id = :id)
                         AND (IFNULL(:code, '') = '' OR ps.code = :code)`;
        const [rows] = await mysql2Pool.query<ProductSeasonRow[]>(query, {id, code});
        return rows.map(row => {
            return {
                ...row,
                active: !!row.active,
                product_available: !!row.product_available,
                properties: JSON.parse(row.properties),
            }
        })
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadSeasons()", err.message);
            return Promise.reject(err);
        }
        debug("loadSeasons()", err);
        return Promise.reject(new Error('Error in loadSeasons()'));
    }
}

export async function saveSeason({
                                     product_season_id,
                                     code,
                                     description = '',
                                     product_available = false,
                                     product_teaser = '',
                                     preSeasonMessage = '',
                                     active = true
                                 }: ProductSeason): Promise<ProductSeason[]> {
    try {
        let id = product_season_id || 0;
        const queryInsert = `INSERT INTO b2b_oscommerce.product_seasons (code, description, product_available,
                                                                         product_teaser,
                                                                         preseason_message,
                                                                         active)
                             VALUES (:code, :description, :product_available, :teaser, :preSeasonMessage, :active)`;
        const queryUpdate = `UPDATE b2b_oscommerce.product_seasons
                             SET code              = :code,
                                 description       = :description,
                                 product_available = :product_available,
                                 product_teaser    = :product_teaser,
                                 preseason_message = :preSeasonMessage,
                                 active            = :active
                             WHERE product_season_id = :product_season_id`;
        const args = {product_season_id, code, description, product_available, product_teaser, preSeasonMessage, active};
        if (!product_season_id) {
            const [{insertId}] = await mysql2Pool.query<ResultSetHeader>(queryInsert, args);
            id = insertId;
        } else {
            await mysql2Pool.query(queryUpdate, args);
        }
        return await loadSeasons({id});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveSeason()", err.message);
            return Promise.reject(err);
        }
        debug("saveSeason()", err);
        return Promise.reject(new Error('Error in saveSeason()'));
    }
}


export async function getSeasons(req: Request, res: Response) {
    try {
        const seasons = await loadSeasons(req.params);
        res.json({seasons});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getSeasons()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getSeasons'});
    }
}

export async function getSeason(req: Request, res: Response) {
    try {
        const code = req.params.code;
        const seasons = await loadSeasons({code});
        if (seasons.length === 0) {
            res.json({error: 'Season not found'});
            return;
        }
        const season = seasons[0];
        res.json({season});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getSeason()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getSeason'});
    }
}

export async function postSeason(req: Request, res: Response) {
    try {
        const {season: params} = req.body;
        const [season] = await saveSeason(params);
        res.json({season});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("postSeason()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postSeason'});
    }
}
