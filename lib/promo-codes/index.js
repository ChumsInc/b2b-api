import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:promo-codes');
export async function loadPromoCodes({ id, active, valid, promo_code }) {
    try {
        const sql = `SELECT id,
                            promo_code,
                            description,
                            active,
                            requirements,
                            actions,
                            valid_from,
                            valid_to,
                            require_code_entry
                     FROM b2b.promo_codes
                     WHERE (ifnull(:id, '') = '' OR id = :id)
                       AND (ifnull(:promo_code, '') = '' OR promo_code = :promo_code)
                       AND (ifnull(:active, '') = '' OR active = :active)
                       AND (ifnull(:valid, '') = '' OR active = 1)
                       AND (ifnull(:valid, '') = '' OR valid_from <= now())
                       AND (ifnull(:valid, '') = '' OR valid_to >= now())
                       AND (ifnull(:valid, '') = '' OR (promo_code = :promo_code OR require_code_entry = 0))
                     ORDER BY promo_code`;
        const args = { id, active, promo_code, valid };
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => {
            return {
                ...row,
                active: !!row.active,
                requirements: JSON.parse(row.requirements ?? '{}'),
                actions: JSON.parse(row.actions ?? '{}'),
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadPromoCodes()", err.message);
            return Promise.reject(err);
        }
        debug("loadPromoCodes()", err);
        return Promise.reject(new Error('Error in loadPromoCodes()'));
    }
}
export const loadCurrentPromoCode = async () => {
    try {
        const codes = await loadPromoCodes({ valid: true });
        const [current] = codes.filter(pc => !pc.require_code_entry);
        return current ?? null;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCurrentPromoCode()", err.message);
            return Promise.reject(err);
        }
        debug("loadCurrentPromoCode()", err);
        return Promise.reject(new Error('Error in loadCurrentPromoCode()'));
    }
};
export async function getPromoCodes(req, res) {
    try {
        const promo_codes = await loadPromoCodes({ ...req.query, ...req.params });
        res.json({ promo_codes });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCodes()", err.message);
            return res.json({ error: err.message });
        }
    }
}
