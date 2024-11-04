import dayjs, {Dayjs} from "dayjs";
import {Response} from 'express'
import {getUserValidation, mysql2Pool} from "chums-local-modules";
import Debug from "debug";
import {RowDataPacket} from "mysql2";

const debug = Debug('chums:lib:carts:utils');

export const dbDateFormat = 'YYYY-MM-DD';
export const dbDateTimeFormat = 'YYYY-MM-DD HH:mm:ss';
export const dbDate = (date?: Date | string | number | Dayjs, format = dbDateFormat): string | null => {
    if (!date) {
        date = new Date();
    }
    const _date = dayjs(date);
    return _date.isValid()
        ? _date.format(format)
        : null;
}

export function getUserId(res: Response): number | null {
    const validation = getUserValidation(res);
    return validation?.profile?.user?.id ?? null;
}

interface UserIdFromSageRow extends RowDataPacket {
    id: number;
}
export async function loadUserIdFromSageUser(userKey: string): Promise<number | null> {
    try {

        const sql = `SELECT u.id
                     FROM users.users u
                              INNER JOIN c2.SY_User su ON su.EmailAddress = u.email
                     WHERE su.UserKey = :userKey`;
        const [rows] = await mysql2Pool.query<UserIdFromSageRow[]>(sql, {userKey});
        return rows[0]?.id ?? null;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getUserIdFromSageUser()", err.message);
            return Promise.reject(err);
        }
        debug("getUserIdFromSageUser()", err);
        return Promise.reject(new Error('Error in getUserIdFromSageUser()'));
    }
}
