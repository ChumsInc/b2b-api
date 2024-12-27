import Debug from 'debug';
import {mysql2Pool} from "chums-local-modules";
import {B2BUserInfo} from "./types/cart-header.js";
import {RowDataPacket} from "mysql2";
import {Request, Response} from "express";

const debug = Debug('chums:lib:carts:cart-user');

export interface B2BUserInfoRow extends RowDataPacket {
    userInfo: string;
}
export async function loadCartUser(userId: string|number): Promise<B2BUserInfo|null> {
    try {
        const sql = `SELECT JSON_OBJECT('id', u.id,
                                        'email', u.email,
                                        'name', u.name,
                                        'company', u.company,
                                        'accountType', u.accountType) as userInfo
                     FROM users.users u
                     WHERE id = :userId`;
        const [rows] = await mysql2Pool.query<B2BUserInfoRow[]>(sql, {userId: userId});
        const [row] = rows;
        if (!row) {
            return null;
        }
        return JSON.parse(row.userInfo) ?? null;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadCartUser()", err.message);
            return Promise.reject(err);
        }
        debug("loadCartUser()", err);
        return Promise.reject(new Error('Error in loadCartUser()'));
    }
}

export const getCartUser = async (req:Request, res:Response) => {
    try {
        const user = await loadCartUser(req.params.userId);
        res.json({user});
        return;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getCartUser()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCartUser'});
    }
}
