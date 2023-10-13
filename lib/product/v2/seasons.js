import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:product:v2:seasons');
export async function loadSeasons({ id, code }) {
    try {
        const query = `SELECT product_season_id,
                              ps.code,
                              ps.description,
                              product_available,
                              product_teaser,
                              ps.active,
                              pms.properties,
                              ps.preseason_message as preSeasonMessage,
                              timestamp
                       FROM b2b_oscommerce.product_seasons ps
                                LEFT JOIN c2.PM_Seasons pms
                                          ON pms.code = ps.code
                       WHERE (IFNULL(:id, 0) = 0 OR product_season_id = :id)
                         AND (IFNULL(:code, '') = '' OR ps.code = :code)`;
        const [rows] = await mysql2Pool.query(query, { id, code });
        return rows.map(row => {
            let properties = {};
            try {
                properties = JSON.parse(row.properties || '{}');
            }
            catch (err) {
            }
            return {
                ...row,
                active: !!row.active,
                product_available: !!row.product_available,
                properties,
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadSeasons()", err.message);
            return Promise.reject(err);
        }
        debug("loadSeasons()", err);
        return Promise.reject(new Error('Error in loadSeasons()'));
    }
}
export async function saveSeason({ product_season_id, code, description = '', product_available = false, product_teaser = '', preSeasonMessage = '', active = true }) {
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
        const args = { product_season_id, code, description, product_available, product_teaser, preSeasonMessage, active };
        if (!product_season_id) {
            const [{ insertId }] = await mysql2Pool.query(queryInsert, args);
            id = insertId;
        }
        else {
            await mysql2Pool.query(queryUpdate, args);
        }
        return await loadSeasons({ id });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveSeason()", err.message);
            return Promise.reject(err);
        }
        debug("saveSeason()", err);
        return Promise.reject(new Error('Error in saveSeason()'));
    }
}
export async function getSeasons(req, res) {
    try {
        const seasons = await loadSeasons(req.params);
        res.json({ seasons });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getSeasons()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getSeasons' });
    }
}
export async function postSeason(req, res) {
    try {
        const { season: params } = req.body;
        const [season] = await saveSeason(params);
        res.json({ season });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postSeason()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postSeason' });
    }
}
