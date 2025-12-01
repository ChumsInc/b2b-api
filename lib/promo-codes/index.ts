import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';
import {PromoCode} from "chums-types/b2b";
import {RowDataPacket} from "mysql2";
import {Request, Response} from "express";

const debug = Debug('chums:lib:promo-codes')

interface PromoCodeRow extends Omit<PromoCode, 'active'| 'requirements'| 'actions'> {
    active: boolean|number;
    requirements: string;
    actions: string;
}

export interface LoadPromoCodesProps {
    id?: number|string;
    active?: boolean|number|string;
    valid?: boolean|number|string;
    promo_code?: string;
}
export async function loadPromoCodes({id, active, valid, promo_code}:LoadPromoCodesProps):Promise<PromoCode[]> {
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
        const args = {id, active, promo_code, valid}
        const [rows] = await mysql2Pool.query<(PromoCodeRow & RowDataPacket)[]>(sql, args);
        return rows.map(row => {
            return {
                ...row,
                active: !!row.active,
                requirements: JSON.parse(row.requirements ?? '{}'),
                actions: JSON.parse(row.actions ?? '{}'),
            } as PromoCode;
        })
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadPromoCodes()", err.message);
            return Promise.reject(err);
        }
        debug("loadPromoCodes()", err);
        return Promise.reject(new Error('Error in loadPromoCodes()'));
    }
}

export const loadCurrentPromoCode = async ():Promise<PromoCode|null> => {
    try {
        const codes = await loadPromoCodes({valid: true});
        const [current] = codes.filter(pc => !pc.require_code_entry);
        return current ?? null;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadCurrentPromoCode()", err.message);
            return Promise.reject(err);
        }
        debug("loadCurrentPromoCode()", err);
        return Promise.reject(new Error('Error in loadCurrentPromoCode()'));
    }
}

export async function getPromoCodes(req:Request, res:Response) {
    try {
        const promo_codes = await loadPromoCodes({...req.query, ...req.params});
        res.json({promo_codes});
    } catch (err:unknown) {
        if (err instanceof Error) {
            debug("getCodes()", err.message);
            return res.json({error: err.message});
        }
    }
}
