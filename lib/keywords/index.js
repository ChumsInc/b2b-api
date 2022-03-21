/**
 * Created by steve on 1/17/2017.
 */

const debug = require('debug')('chums:lib:keywords');
const router = require('express').Router();
const {mysql2Pool} = require('chums-local-modules');

const load = async ({keyword = null, active = null} = {}) => {
    try {
        const query = `SELECT pagetype,
                              keyword,
                              title,
                              parent,
                              additional_data,
                              redirect_to_parent,
                              status,
                              id
                       FROM b2b_oscommerce.keywords
                       WHERE (:keyword IS NULL OR keyword = :keyword)
                         AND (:active IS NULL OR status = :active)`;
        const data = {keyword, active};
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => {
            const additionalData = JSON.parse(row.additional_data || '{}');
            delete row.additional_data;
            return {...row, ...additionalData};
        });
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
};

const get = async (req, res) => {
    try {
        const params = {...req.params};
        params.active = req.query.active || null;
        const result = await load(params);
        res.json({result});
    } catch(err) {
        debug("get()", err.message);
        res.json({error: err.message});
    }
};

router.get('/:keyword?', get);
exports.router = router;
exports.load = load;
