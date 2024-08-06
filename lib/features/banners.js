import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';
import dayjs from "dayjs";

const debug = Debug('chums:lib:features:banners');

/**
 *
 * @param {boolean} [active]
 * @param {number|string} [id]
 * @return {Promise<Banner[]>}
 */
export async function loadBanners({active, id}) {
    try {
        const sql = `SELECT id,
                            title,
                            url,
                            image,
                            overlay,
                            startDate,
                            endDate,
                            active,
                            priority,
                            componentSrc,
                            sxProps,
                            timestamp
                     FROM b2b_oscommerce.banners
                     WHERE (IFNULL(:id, 0) = 0 OR id = :id)
                       AND (IFNULL(:active, 1) = 0 OR (
                         active = 1 AND
                         (NULLIF(startDate, '') IS NULL OR startDate < NOW()) AND
                         (NULLIF(endDate, '') IS NULL OR endDate > NOW())))
                     ORDER BY priority, id`;
        const args = {active, id};
        debug('loadBanners()', args);
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => ({
            ...row,
            active: !!row.active,
            image: JSON.parse(row.image ?? 'null'),
            overlay: JSON.parse(row.overlay ?? 'null'),
            sxProps: JSON.parse(row.sxProps ?? 'null')
        }))
    } catch (err) {
        if (err instanceof Error) {
            console.debug("loadBanners()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadBanners()", err);
        return Promise.reject(new Error('Error in loadBanners()'));
    }
}

export async function saveBanner(banner) {
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
            image: !!banner.image ? JSON.stringify(banner.image) : null,
            overlay: !!banner.overlay ? JSON.stringify(banner.overlay) : null,
            startDate: dayjs(banner.startDate).isValid() ? dayjs(banner.startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss') : null,
            endDate: dayjs(banner.endDate).isValid() ? dayjs(banner.endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss') : null,
            active: banner.active ? 1 : 0,
            priority: banner.priority ?? 0,
            componentSrc: banner.componentSrc ?? null,
            sxProps: !!banner.sxProps ? JSON.stringify(banner.sxProps) : null
        };
        if (!banner.id) {
            const [result] = await mysql2Pool.query(sqlInsert, args);
            banner.id = result.insertId;
        } else {
            await mysql2Pool.query(sqlUpdate, args);
        }
        return await loadBanners({id: banner.id});
    } catch (err) {
        if (err instanceof Error) {
            console.debug("saveBanner()", err.message);
            return Promise.reject(err);
        }
        console.debug("saveBanner()", err);
        return Promise.reject(new Error('Error in saveBanner()'));
    }
}


/**
 *
 * @param id
 * @return {Promise<Banner[]>}
 */
export async function deleteBanner(id) {
    try {
        const sql = `DELETE
                     FROM b2b_oscommerce.banners
                     WHERE id = :id`;
        const args = {id};
        await mysql2Pool.query(sql, args);
        return await loadBanners({active: 0});
    } catch (err) {
        if (err instanceof Error) {
            console.debug("deleteBanner()", err.message);
            return Promise.reject(err);
        }
        console.debug("deleteBanner()", err);
        return Promise.reject(new Error('Error in deleteBanner()'));
    }
}

export const getBanners = async (req, res) => {
    try {
        const id = req.params.id;
        const active = 0;
        const banners = await loadBanners({active, id});
        res.json({banners});
    } catch (err) {
        if (err instanceof Error) {
            debug("getBanners()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getBanners'});
    }
}

export const getActiveBanners = async (req, res) => {
    try {
        const id = req.params.id;
        const active = 1;
        const banners = await loadBanners({active, id});
        res.json({banners});
    } catch (err) {
        if (err instanceof Error) {
            debug("getBanners()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getBanners'});
    }
}

export const postBanner = async (req, res) => {
    try {
        const [banner = null] = await saveBanner(req.body);
        res.json({banner});
    } catch (err) {
        if (err instanceof Error) {
            debug("postBanner()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postBanner'});
    }
}

export const delBanner = async (req, res) => {
    try {
        const banners = await deleteBanner(req.params.id);
        res.json({banners});
    } catch (err) {
        if (err instanceof Error) {
            debug("delBanner()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delBanner'});
    }
}
