/**
 * Created by steve on 1/17/2017.
 */
import Debug from "debug";
import {mysql2Pool} from "chums-local-modules";

const debug = Debug('chums:lib:keywords');

export const loadKeywords = async ({keyword = null, active = null} = {}) => {
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

export const getKeywords = async (req, res) => {
    try {
        const params = {...req.params};
        params.active = req.query.active || null;
        const result = await loadKeywords(params);
        res.json({result});
    } catch(err) {
        debug("get()", err.message);
        res.json({error: err.message});
    }
};
