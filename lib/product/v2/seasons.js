const debug = require('debug')('chums:lib:product:v2:seasons');
const {mysql2Pool} = require('chums-local-modules');

async function loadSeasons({id, code}) {
    try {
        const query = `SELECT product_season_id, code, description, product_available, product_teaser, active, timestamp
                       FROM b2b_oscommerce.product_seasons
                       WHERE (ifnull(:id, 0) = 0 OR product_season_id = :id)
                         AND (ifnull(:code, '') = '' OR code = :code)`;
        const [rows] = await mysql2Pool.query(query, {id, code});
        rows.forEach(row => {
            row.active = row.active === 1;
            row.product_available = row.product_available === 1;
        });
        return rows;
    } catch (err) {
        debug("loadSpecials()", err.message);
        return err;
    }
}

exports.loadSeasons = loadSeasons;

async function saveSeason({product_season_id, code, description = '', product_available = false, teaser = '', active = true}) {
    try {
        const queryInsert = `INSERT INTO b2b_oscommerce.product_seasons (code, description, product_available, product_teaser, active)
                             VALUES (:code, :description, :product_available, :teaser, :active)`;
        const queryUpdate = `UPDATE b2b_oscommerce.product_seasons
                             SET code              = :code,
                                 description       = :description,
                                 product_available = :product_available,
                                 product_teaser    = :teaser,
                                 active            = :active
                             WHERE product_season_id = :product_season_id`;
        const args = {product_season_id, code, description, product_available, teaser, active};
        if (!product_season_id) {
            const [{insertId}] = await mysql2Pool.query(queryInsert, args);
            product_season_id = insertId;
        } else {
            await mysql2Pool.query(queryUpdate, args);
        }
        return await loadSeasons({id: product_season_id});
    } catch (err) {
        debug("saveSeason()", err.message);
        return err;
    }
}

exports.saveSeason = saveSeason;

exports.getSeasons = async (req, res) => {
    try {
        const seasons = await loadSeasons(req.params);
        res.json({seasons});
    } catch (err) {
        debug("getSeasons()", err.message);
        res.json({error: err.message});
    }
}

exports.postSeason = async (req, res) => {
    try {
        const {season: params} = req.body;
        const [season] = await saveSeason(params);
        res.json({season});
    } catch (err) {
        debug("postSeason()", err.message);
        res.json({error: err.message});
    }
}
