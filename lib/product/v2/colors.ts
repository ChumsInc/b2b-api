import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';
import {ColorProductUsage, ProductColor} from "b2b-types";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {Request, Response} from "express";

const debug = Debug('chums:lib:product:v2:colors');


interface ProductColorRow extends Omit<ProductColor, 'active'>, RowDataPacket {
    active: 1|0|null,
}

interface ColorProductUsageRow extends Omit<ColorProductUsage, 'status'>, RowDataPacket {
    status: 1|0,
}


interface LoadColorsProps {
    id?: string|number|null,
    code?:string|null,
}
async function loadColors({id = null, code = null}:LoadColorsProps):Promise<ProductColor[]> {
    try {
        const query = `SELECT c.colors_id  AS id,
                              c.color_code AS code,
                              ifnull(sc.description, c.color_name) AS name,
                              sc.active
                       FROM b2b_oscommerce.colors c
                            LEFT JOIN c2.sku_colors sc
                                      ON sc.code = c.color_code
                       WHERE (ifnull(:id, '') = '' OR colors_id = :id)
                         AND (IFNULL(:code, '') = '' OR color_code = :code)
                       ORDER BY code`;
        const data = {id, code};
        const [rows] = await mysql2Pool.query<ProductColorRow[]>(query, data);
        return rows.map(row => {
            return {
                ...row,
                active: row.active === null ? null : !!row.active
            }
        })
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadColors()", err.message);
            return Promise.reject(err);
        }
        debug("loadColors()", err);
        return Promise.reject(new Error('Error in loadColors()'));
    }
}

async function saveColor({id, code, name}:Partial<ProductColor>):Promise<ProductColor[]> {
    try {
        const colors = await loadColors({});
        const [color] = colors.filter(color => color.code === code);
        if (color && color.id !== Number(id)) {
            return Promise.reject(new Error(`Color code '${code}' already exists`));
        }
        const queryInsert = `INSERT INTO b2b_oscommerce.colors (color_code, color_name)
                             VALUES (:code, :name)`;
        const queryUpdate = `UPDATE b2b_oscommerce.colors
                             SET color_code = :code,
                                 color_name = :name
                             WHERE colors_id = :id`;
        const data = {id, code, name};


        if (!id || Number(id) === 0) {
            const [{insertId}] = await mysql2Pool.query<ResultSetHeader>(queryInsert, data);
            id = insertId;
        } else {
            await mysql2Pool.query(queryUpdate, data);
        }

        return await loadColors({id});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("saveColor()", err.message);
            return Promise.reject(err);
        }
        debug("saveColor()", err);
        return Promise.reject(new Error('Error in saveColor()'));
    }
}

async function loadColorUsage(id:number|string):Promise<ColorProductUsage[]> {
    try {
        const query = `SELECT p.products_id                                                 AS productId,
                              p.products_keyword                                            AS keyword,
                              d.products_name                                               AS name,
                              i.itemCode,
                              IF(
                                          i.active
                                          AND p.products_status
                                          AND IFNULL(ci.ItemCode, 0)
                                          AND IFNULL(ci.ProductType, 'D') <> 'D'
                                          AND IFNULL(ci.InactiveItem, 'Y') <> 'Y'
                                  , 1, 0
                                  )                                                         AS status,
                              1 as itemQuantity,
                              JSON_UNQUOTE(JSON_EXTRACT(i.additionalData, '$.swatch_code')) AS swatchCode,
                              IFNULL(JSON_UNQUOTE(JSON_EXTRACT(i.additionalData, '$.image_filename')),
                                     p.products_image)                                      AS image
                       FROM b2b_oscommerce.products p
                            INNER JOIN b2b_oscommerce.manufacturers m
                                       ON m.manufacturers_id = p.manufacturers_id
                            INNER JOIN b2b_oscommerce.products_description d
                                       ON d.products_id = p.products_id AND d.language_id = 1
                            INNER JOIN b2b_oscommerce.products_items i
                                       ON i.productsID = p.products_id
                            LEFT JOIN c2.ci_item ci
                                      ON ci.company = m.company AND ci.ItemCode = i.itemCode
                       WHERE i.colorsID = :id
                       ORDER BY itemCode `;
        const data = {id};

        const [rows] = await mysql2Pool.query<ColorProductUsageRow[]>(query, data);
        return rows.map(row => ({...row, status: !!row.status}));
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadColorUsage()", err.message);
            return Promise.reject(err);
        }
        debug("loadColorUsage()", err);
        return Promise.reject(new Error('Error in loadColorUsage()'));
    }
}

async function loadMixUsage(id:number|string):Promise<ColorProductUsage[]> {
    try {
        const query = `SELECT p.products_id      AS productId,
                              p.products_keyword AS keyword,
                              ci.ItemCodeDesc as name,
                              m.itemCode,
                              IF(
                                          p.products_status
                                          AND IFNULL(ci.ItemCode, 0)
                                          AND IFNULL(ci.ProductType, 'D') <> 'D'
                                          AND IFNULL(ci.InactiveItem, 'Y') <> 'Y'
                                  , 1, 0
                                  )              AS status,
                              md.itemQuantity,
                              JSON_UNQUOTE(JSON_EXTRACT(i.additionalData, '$.swatch_code')) AS swatchCode,
                              IFNULL(JSON_UNQUOTE(JSON_EXTRACT(i.additionalData, '$.image_filename')),
                                     p.products_image)                                      AS image
                       FROM b2b_oscommerce.products p
                            INNER JOIN b2b_oscommerce.manufacturers mfg
                                       ON mfg.manufacturers_id = p.manufacturers_id
                            INNER JOIN b2b_oscommerce.products_mixes m
                                       ON m.productsID = p.products_id
                            INNER JOIN b2b_oscommerce.products_mixes_detail md
                                       ON md.mixID = m.mixID
                            LEFT JOIN b2b_oscommerce.products_items i on i.itemCode = md.itemCode
                            LEFT JOIN c2.ci_item ci
                                      ON ci.Company = mfg.Company AND ci.ItemCode = m.itemCode
                       WHERE md.colorsID = :id
                       ORDER BY m.itemCode`;
        const data = {id};

        const [rows] = await mysql2Pool.query<ColorProductUsageRow[]>(query, data);
        return rows.map(row => ({...row, status: !!row.status}));
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadMixUsage()", err.message);
            return Promise.reject(err);
        }
        debug("loadMixUsage()", err);
        return Promise.reject(new Error('Error in loadMixUsage()'));
    }
}

export async function getColors(req:Request, res:Response) {
    try {
        const colors = await loadColors(req.params);
        res.json({colors});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getColors()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getColors'});
    }
}

export async function getItems(req:Request, res:Response) {
    try {
        const items = await loadColorUsage(req.params.id);
        res.json({items});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getItems()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getItems'});
    }
}

export async function getMixItems(req:Request, res:Response) {
    try {
        const items = await loadMixUsage(req.params.id);
        res.json({items});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getMixItems()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getMixItems'});
    }
}

export async function postColor(req:Request, res:Response) {
    try {
        const [color] = await saveColor(req.body);
        const colors = await loadColors({});
        res.json({colors, color});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postColor()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postColor'});
    }
}
