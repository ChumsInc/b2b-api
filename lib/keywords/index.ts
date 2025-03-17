import Debug from "debug";
import {mysql2Pool} from "chums-local-modules";
import {Keyword} from "b2b-types";
import {RowDataPacket} from "mysql2";
import {Request, Response} from 'express';

const debug = Debug('chums:lib:keywords');

export interface KeywordRow extends RowDataPacket, Keyword {
    additional_data: string;
}

export interface LoadKeywordsProps {
    keyword?: string | null;
    includeInactive?: boolean;
}

export const loadKeywords = async ({keyword = null, includeInactive}: LoadKeywordsProps): Promise<Keyword[]> => {
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
        const data = {keyword, includeInactive};
        const [rows] = await mysql2Pool.query<KeywordRow[]>(query, data);
        return rows.map(row => {
            const {additional_data, ...rest} = row;
            const additionalData = JSON.parse(additional_data || '{}');
            return {...rest, ...additionalData};
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadKeywords()", err.message);
            return Promise.reject(err);
        }
        debug("loadKeywords()", err);
        return Promise.reject(new Error('Error in loadKeywords()'));
    }
};

export const getKeywords = async (req: Request, res: Response) => {
    try {
        const includeInactive = !!req.query.include_inactive;
        const params: LoadKeywordsProps = {
            ...req.params,
            includeInactive
        };
        const result = await loadKeywords(params);
        res.json({result});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getKeywords()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getKeywords'});
    }
};

export const getKeyword = async (req: Request, res: Response) => {
    try {
        const [row] = await loadKeywords({keyword: req.params.keyword, includeInactive: true});
        res.json({keyword: row ?? null});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getKeyword()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getKeyword'});
    }
}
