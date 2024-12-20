import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';
import {ProductAdditionalData, ProductColorVariant} from "b2b-types";
import {RowDataPacket} from "mysql2";
import {Request, Response} from "express";
import {loadSeasons} from './seasons.js';

const debug = Debug('chums:lib:product:v2:item');

interface ProductColorVariantRow extends Omit<ProductColorVariant, 'status' | 'additionalData' | 'inactiveItem'>, RowDataPacket {
    status: 1 | 0,
    inactiveItem: 1 | 0 | null,
    additionalData: string,
}

export interface LoadItemsProps {
    id?: number | string,
    productId?: number | string,
    productIdList?: (number | string)[]
}

export async function loadProductItems({
                                           id,
                                           productId,
                                           productIdList = [0]
                                       }: LoadItemsProps): Promise<ProductColorVariant[]> {
    try {
        if (productId) {
            productIdList.push(productId);
        }
        // debug('loadItems()', {id, productIdList});
        const query = `SELECT i.id,
                              i.productsID                    AS productId,
                              i.colorsID                      AS colorsId,
                              i.colorCode,
                              i.itemCode,
                              c.color_name                    AS colorName,
                              i.active                        AS status,
                              i.active                        AS selfStatus,
                              ci.SuggestedRetailPrice         AS msrp,
                              ci.StandardUnitPrice            AS stdPrice,
                              ci.PriceCode                    AS priceCode,
                              ci.StandardUnitOfMeasure        AS stdUM,
                              ci.SalesUnitOfMeasure           AS salesUM,
                              ci.SalesUMConvFctr              AS salesUMFactor,
                              ci.ShipWeight                   AS shipWeight,
                              ci.ProductType                  AS productType,
                              w.QuantityAvailable,
                              if(ci.InactiveItem = 'Y', 1, 0) AS inactiveItem,
                              w.buffer,
                              ci.UDF_UPC                      AS upc,
                              JSON_EXTRACT(ifnull(i.additionalData, '{}'), '$')  AS additionalData,
                              i.timestamp,
                              ia.ItemStatus                   as productStatus
                       FROM b2b_oscommerce.products_items i
                                INNER JOIN b2b_oscommerce.products p
                                           ON p.products_id = i.productsID
                                LEFT JOIN b2b_oscommerce.manufacturers m
                                          ON p.manufacturers_id = m.manufacturers_id
                                LEFT JOIN b2b_oscommerce.colors c
                                          ON c.colors_id = i.colorsID
                                LEFT JOIN c2.ci_item ci
                                          ON ci.Company = m.company AND ci.ItemCode = i.itemCode
                                LEFT JOIN c2.v_web_available w
                                          ON w.Company = ci.company AND w.ItemCode = ci.ItemCode AND
                                             w.WarehouseCode = ci.DefaultWarehouseCode
                                LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                          ON ia.company = ci.company
                                              AND ia.ItemCode = ci.ItemCode
                                              AND ia.WarehouseCode = ci.DefaultWarehouseCode
                       WHERE (p.products_id IN (:productIdList) OR i.id = :id)
                       ORDER BY i.ItemCode`;
        const data = {id, productIdList};

        const [rows] = await mysql2Pool.query<ProductColorVariantRow[]>(query, data);

        const seasons = await loadSeasons({});
        return rows.map(row => {
            let additionalData: ProductAdditionalData = {};
            try {
                additionalData = JSON.parse(row.additionalData);
            } catch (err: unknown) {
            }
            if (additionalData.season_id) {
                const [season] = seasons.filter(s => s.product_season_id === additionalData.season_id);
                additionalData.season = season ?? null;
            }
            return {
                ...row,
                inactiveItem: row.inactiveItem === 1,
                status: !!row.status && !(!row.productType || row.productType === 'D' || row.inactiveItem === 1),
                additionalData,
                QuantityAvailable: Number(row.QuantityAvailable),
                color: {
                    id: row.colorsId,
                    code: row.colorCode,
                    name: row.colorName,
                    swatchCode: additionalData.swatch_code || null
                },
                selfStatus: row.status === 1,
            }
        })
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadProductItems()", err.message);
            return Promise.reject(err);
        }
        debug("loadProductItems()", err);
        return Promise.reject(new Error('Error in loadItems()'));
    }
}

interface ProductItemIDRow extends RowDataPacket {
    id: number,
}

async function saveNewProductItem({productId, colorsId}: Partial<ProductColorVariant>): Promise<number> {
    try {
        const query = `INSERT IGNORE INTO b2b_oscommerce.products_items (productsID, colorsID, itemCode)
                       VALUES (:productId, :colorsId, '')`;
        const qId = `SELECT id
                     FROM b2b_oscommerce.products_items
                     WHERE productsID = :productId
                       AND colorsID = :colorsId`;

        const data = {productId, colorsId};
        debug('saveNewProductItem()', {productId, colorsId});

        await mysql2Pool.query(query, data);
        const [[item]] = await mysql2Pool.query<ProductItemIDRow[]>(qId, data);

        return item.id;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveNewProductItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewProductItem()", err);
        return Promise.reject(new Error('Error in saveNewProductItem()'));
    }
}

async function saveProductItem({
                                   id,
                                   productId,
                                   colorsId,
                                   colorCode,
                                   itemCode,
                                   status,
                                   additionalData
                               }: ProductColorVariant) {
    try {
        if (Number(id) === 0) {
            id = await saveNewProductItem({productId, colorsId});
        }
        const query = `UPDATE b2b_oscommerce.products_items
                       SET colorCode      = :colorCode,
                           itemCode       = :itemCode,
                           active         = :status,
                           additionalData = :additionalData
                       WHERE id = :id`;
        const data = {id, colorCode, itemCode, status, additionalData: JSON.stringify(additionalData)};
        await mysql2Pool.query(query, data);
        return await loadProductItems({productId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveProductItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveProductItem()", err);
        return Promise.reject(new Error('Error in saveProductItem()'));
    }
}

async function deleteProductItem({id, productId}: Partial<ProductColorVariant>): Promise<ProductColorVariant[]> {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.products_items
                       WHERE id = :id
                         AND productsID = :productId`;
        const data = {id, productId};
        await mysql2Pool.query(query, data);
        return await loadProductItems({productId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("deleteItem()", err.message);
            return Promise.reject(err);
        }
        debug("deleteItem()", err);
        return Promise.reject(new Error('Error in deleteItem()'));
    }
}

export async function getProductItems(req: Request, res: Response) {
    try {
        const {productId, id} = req.params;
        const items = await loadProductItems({id, productId});
        res.json({items});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getItems()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getItems'});
    }
}

export async function postProductItem(req: Request, res: Response) {
    try {
        const items = await saveProductItem(req.body);
        res.json({items});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("postItem()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postItem'});
    }
}

export async function delProductItem(req: Request, res: Response) {
    try {
        const items = await deleteProductItem(req.params);
        res.json({items});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("delProductItem()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delProductItem'});
    }
}


