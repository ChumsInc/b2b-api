import Debug from "debug";
import dayjs, {Dayjs} from "dayjs";
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import {Request, Response} from "express";
import {holidayFormat, holidays} from "./holidays.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('America/Denver');

const debug = Debug('chums:lib:carts:ship-date');

const defaultDaysToShip = 5;

function isHoliday(day: Date | string | Dayjs): boolean {
    return holidays.includes(dayjs(day).format(holidayFormat));
}

function isWorkDay(day: Date | string | Dayjs): boolean {
    return !isHoliday(day) && [1, 2, 3, 4, 5].includes(dayjs(day).get('d'));
}

const nextShipDate = (daysToShip?: number) => {
    let remaining = (daysToShip ?? defaultDaysToShip);
    let shipDate = dayjs().startOf('day').set('hour', 8);
    if (isWorkDay(shipDate) && dayjs().get('hour') > 16 || (dayjs().get('hour') > 11 && dayjs().get('day') === 5)) {
        shipDate = shipDate.add(1, 'd').startOf('day').set('hour', 8);
    }
    while (remaining > 0) {
        shipDate = shipDate.add(1, 'day')
        if (isWorkDay(shipDate)) {
            remaining -= 1;
        }
    }
    return shipDate;
}

export const getNextShipDate = async (req: Request, res: Response) => {
    try {
        const next = nextShipDate();
        res.json({
            nextShipDate: next
        })
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getNextShipDate()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getNextShipDate'});
    }
}
