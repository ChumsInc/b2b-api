import Debug from "debug";
import dayjs, {Dayjs} from "dayjs";
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import {Request, Response} from "express";
import {holidayFormat, loadHolidays} from "./holidays.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('America/Denver');

const debug = Debug('chums:lib:carts:ship-date');

const defaultDaysToShip = 5;


function isHoliday(day: Date | string | Dayjs, holidays: string[]): boolean {
    return holidays.includes(dayjs(day).format(holidayFormat));
}

function isWorkDay(day: Date | string | Dayjs, holidays: string[]): boolean {
    return !isHoliday(day, holidays) && [1, 2, 3, 4, 5].includes(dayjs(day).get('d'));
}

async function nextShipDate(daysToShip?: number):Promise<string> {
    const holidays = await loadHolidays();
    let remaining = (daysToShip ?? defaultDaysToShip);
    let shipDate = dayjs().startOf('day').set('hour', 8);
    if (isWorkDay(shipDate, holidays) && (
        (dayjs().get('day') < 5 && dayjs().get('hour') > 16)
        || (dayjs().get('day') === 5 && dayjs().get('hour') > 11)
    )) {
        shipDate = shipDate.add(1, 'd').startOf('day').set('hour', 8);
    }
    while (remaining > 0) {
        shipDate = shipDate.add(1, 'day')
        if (isWorkDay(shipDate, holidays)) {
            remaining -= 1;
        }
    }
    return shipDate.toISOString();
}

export const getNextShipDate = async (req: Request, res: Response) => {
    try {
        const next = await nextShipDate();
        res.json({
            nextShipDate: next
        })
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getNextShipDate()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getNextShipDate'});
    }
}

export const getHolidays = async (req: Request, res: Response) => {
    try {
        const holidays = await loadHolidays();
        res.json({holidays});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getHolidays()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getHolidays'});
    }
}
