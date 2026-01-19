import Debug from "debug";
import {RowDataPacket} from "mysql2";
import {mysql2Pool} from "chums-local-modules";
import dayjs from "dayjs";

const debug = Debug('chums:lib:carts:holidays');

export const holidayFormat = 'YYYY-MM-DD'

interface HolidayRow extends RowDataPacket {
    holiday: string;
}

export async function loadHolidays(): Promise<string[]> {
    try {
        const sql = `SELECT DATE(date) as holiday
                     FROM timeclock.Holidays
                     WHERE paid = 1`;
        const [rows] = await mysql2Pool.query<HolidayRow[]>(sql);
        return rows.map(row => dayjs(row.holiday).format(holidayFormat));
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadHolidays()", err.message);
            return Promise.reject(err);
        }
        debug("loadHolidays()", err);
        return Promise.reject(new Error('Error in loadHolidays()'));
    }
}
