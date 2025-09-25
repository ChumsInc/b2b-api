import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';
import dayjs from "dayjs";
import {Banner} from "b2b-types";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {Request, Response} from "express";

const debug = Debug('chums:lib:features:banners');

interface BannerRow extends RowDataPacket, Omit<Banner, 'image' | 'overlay' | 'sxProps' | 'active'> {
    active: number;
    image: string;
    overlay: string;
    sxProps: string;
}

export interface LoadBannersProps {
    active?: boolean;
    id?: number | string;
}

export async function loadBanners({active, id}: LoadBannersProps): Promise<Banner[]> {
    try {
        const sql = `SELECT id,
                            title,
                            url,
                            JSON_EXTRACT(image, '$')   AS image,
                            JSON_EXTRACT(overlay, '$') AS overlay,
                            startDate,
                            endDate,
                            active,
                            priority,
                            componentSrc,
                            JSON_EXTRACT(sxProps, '$') AS sxProps,
                            timestamp
                     FROM b2b_oscommerce.banners
                     WHERE (IFNULL(:id, 0) = 0 OR id = :id)
                       AND (IFNULL(:active, 1) = 0 OR (
                         active = 1 AND
                         (NULLIF(startDate, '') IS NULL OR startDate < NOW()) AND
                         (NULLIF(endDate, '') IS NULL OR endDate > NOW())))
                     ORDER BY priority, id`;
        const args = {active, id};
        const [rows] = await mysql2Pool.query<BannerRow[]>(sql, args);
        return rows.map(row => ({
            ...row,
            active: !!row.active,
            image: JSON.parse(row.image ?? 'null'),
            overlay: JSON.parse(row.overlay ?? 'null'),
            sxProps: JSON.parse(row.sxProps ?? 'null')
        }))
    } catch (err) {
        if (err instanceof Error) {
            debug("loadBanners()", err.message);
            return Promise.reject(err);
        }
        debug("loadBanners()", err);
        return Promise.reject(new Error('Error in loadBanners()'));
    }
}

export async function saveBanner(banner: Banner): Promise<Banner[]> {
    try {
        const sqlInsert = `INSERT INTO b2b_oscommerce.banners
                           (title, url, image, overlay, startDate, endDate, active, priority, componentSrc, sxProps)
                           VALUES (:title, :url, :image, :overlay, :startDate, :endDate, :active, :priority,
                                   :componentSrc,
                                   :sxProps)`;
        const sqlUpdate = `UPDATE b2b_oscommerce.banners
                           SET title        = :title,
                               url          = :url,
                               image        = :image,
                               overlay      = :overlay,
                               startDate    = :startDate,
                               endDate      = :endDate,
                               active       = :active,
                               priority     = :priority,
                               componentSrc = :componentSrc,
                               sxProps      = :sxProps
                           WHERE id = :id`;
        const args = {
            id: banner.id,
            title: banner.title ?? '',
            url: banner.url ?? null,
            image: banner.image ? JSON.stringify(banner.image) : null,
            overlay: banner.overlay ? JSON.stringify(banner.overlay) : null,
            startDate: dayjs(banner.startDate).isValid() ? dayjs(banner.startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss') : null,
            endDate: dayjs(banner.endDate).isValid() ? dayjs(banner.endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss') : null,
            active: banner.active ? 1 : 0,
            priority: banner.priority ?? 0,
            componentSrc: banner.componentSrc ?? null,
            sxProps: banner.sxProps ? JSON.stringify(banner.sxProps) : null
        };
        if (!banner.id) {
            const [result] = await mysql2Pool.query<ResultSetHeader>(sqlInsert, args);
            banner.id = result.insertId;
        } else {
            await mysql2Pool.query(sqlUpdate, args);
        }
        return await loadBanners({id: banner.id});
    } catch (err) {
        if (err instanceof Error) {
            debug("saveBanner()", err.message);
            return Promise.reject(err);
        }
        debug("saveBanner()", err);
        return Promise.reject(new Error('Error in saveBanner()'));
    }
}


/**
 *
 * @param id
 * @return {Promise<Banner[]>}
 */
export async function deleteBanner(id: number | string): Promise<Banner[]> {
    try {
        const sql = `DELETE
                     FROM b2b_oscommerce.banners
                     WHERE id = :id`;
        const args = {id};
        await mysql2Pool.query(sql, args);
        return await loadBanners({active: false});
    } catch (err) {
        if (err instanceof Error) {
            debug("deleteBanner()", err.message);
            return Promise.reject(err);
        }
        debug("deleteBanner()", err);
        return Promise.reject(new Error('Error in deleteBanner()'));
    }
}

export const getBanners = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        const active = false;
        const banners = await loadBanners({active, id});
        res.json({banners});
    } catch (err) {
        if (err instanceof Error) {
            debug("getBanners()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getBanners'});
    }
}

export const getActiveBanners = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        const active = true;
        const banners = await loadBanners({active, id});
        res.json({banners});
    } catch (err) {
        if (err instanceof Error) {
            debug("getBanners()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getBanners'});
    }
}

export const postBanner = async (req: Request, res: Response): Promise<void> => {
    try {
        const [banner = null] = await saveBanner(req.body);
        res.json({banner});
    } catch (err) {
        if (err instanceof Error) {
            debug("postBanner()", err.message);
            res.json({error: err.message, name: err.name});
            return
        }
        res.json({error: 'unknown error in postBanner'});
    }
}

export const delBanner = async (req: Request, res: Response): Promise<void> => {
    try {
        const banners = await deleteBanner(req.params.id);
        res.json({banners});
    } catch (err) {
        if (err instanceof Error) {
            debug("delBanner()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in delBanner'});
    }
}
