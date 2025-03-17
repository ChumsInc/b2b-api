import Debug from "debug";
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:keywords');
export const loadKeywords = async ({ keyword = null, includeInactive }) => {
    try {
        const query = `SELECT kw.pagetype,
                              kw.keyword,
                              kw.title,
                              kw.parent,
                              kw.additional_data,
                              kw.redirect_to_parent,
                              kw.status,
                              kw.id
                       FROM b2b_oscommerce.keywords kw
                       WHERE (IFNULL(:keyword, '') = '' OR kw.keyword = :keyword)
                         AND IF(IFNULL(:includeInactive, 0), TRUE, kw.status = 1)`;
        const data = { keyword, includeInactive };
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => {
            const { additional_data, ...rest } = row;
            const additionalData = JSON.parse(additional_data || '{}');
            return { ...rest, ...additionalData };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadKeywords()", err.message);
            return Promise.reject(err);
        }
        debug("loadKeywords()", err);
        return Promise.reject(new Error('Error in loadKeywords()'));
    }
};
export const getKeywords = async (req, res) => {
    try {
        const includeInactive = !!req.query.include_inactive;
        const params = {
            ...req.params,
            includeInactive
        };
        const result = await loadKeywords(params);
        res.json({ result });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getKeywords()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getKeywords' });
    }
};
export const getKeyword = async (req, res) => {
    try {
        const [row] = await loadKeywords({ keyword: req.params.keyword, includeInactive: true });
        res.json({ keyword: row ?? null });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getKeyword()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getKeyword' });
    }
};
