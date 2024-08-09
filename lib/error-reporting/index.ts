import Debug from 'debug'
import {loadValidation, mysql2Pool} from 'chums-local-modules';
import type {ErrorReport, ErrorReportArg, ErrorReportRow} from "./error-reporting-types.d.ts";
import {Request, Response} from 'express'

const debug = Debug('chums:lib:error-reporting');


async function logErrors(arg:ErrorReportArg) {
    try {
        const sql = `INSERT INTO b2b.user_errors (ip_address, version, user_id, url, message, componentStack, debug,
                                                  user_agent, referrer)
                     VALUES (:ip_address, :version, :user_id, :url, :message, :componentStack, null, :user_agent,
                             :referrer)`;
        const args = {
            ip_address: arg.ip,
            version: arg.version ?? '',
            user_id: arg.user_id ?? 0,
            url: arg.url ?? null,
            message: arg.message ?? null,
            componentStack: arg.componentStack ?? null,
            debug: !!arg.debug ? JSON.stringify(arg.debug) : null,
            user_agent: arg.user_agent ?? null,
            referrer: arg.referrer ?? null,
        };
        await mysql2Pool.query(sql, args);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("logErrors()", err.message);
            return Promise.reject(err);
        }
        debug("logErrors()", err);
        return Promise.reject(new Error('Error in logErrors()'));
    }
}

async function loadErrors({ip, user_id, limit = 0, offset = 0}:{
    ip?: string|null;
    user_id?: string|number|null;
    limit?: number|string;
    offset?: number|string;
}):Promise<ErrorReport[]> {
    try {
        limit = Number(limit) || 100;
        offset = Number(offset) || 0;
        const sql = `SELECT id,
                            version,
                            ip_address,
                            user_id,
                            url,
                            componentStack,
                            debug,
                            message,
                            user_agent,
                            referrer,
                            timestamp
                     FROM b2b.user_errors
                     WHERE (IFNULL(:ip, '') = :ip OR ip_address = :ip)
                       AND (IFNULL(:user_id, 0) = 0 OR user_id = :user_id)
                     ORDER BY id DESC
                     LIMIT :limit OFFSET :offset`;
        const args = {
            ip,
            user_id,
            limit: isNaN(limit) ? 100 : limit,
            offset: isNaN(offset) ? 0 : offset
        };
        const [rows] = await mysql2Pool.query<ErrorReportRow[]>(sql, args);
        return rows.map(row => {
            let debug:unknown = null
            try {
                debug = !!row.debug ? JSON.parse(row.debug) : null;
            } catch(err:unknown) {}
            return {
                ...row,
                debug
            }
        })
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadErrors()", err.message);
            return Promise.reject(err);
        }
        debug("loadErrors()", err);
        return Promise.reject(new Error('Error in loadErrors()'));
    }
}

export async function postError(req:Request, res:Response) {
    try {
        const ip = req.ip;
        const user_agent = req.get('User-Agent');
        const referrer = req.get('referrer');
        try {
            const user = await loadValidation(req);
            if (user?.profile?.user) {
                req.body.user_id = user.profile.user.id;
            }
        } catch(err) {}

        await logErrors({...req.body, ip, user_agent, referrer});
        res.json({logged: true});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postError()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postError'});
    }
}


