import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:validation:product-images');
async function loadProductImages(options) {
    try {
        const sql = `SELECT d.productsID         AS productId,
                            d.keyword,
                            d.ItemCode           AS itemCode,
                            d.active,
                            i.ItemCodeDesc       AS itemCodeDesc,
                            i.ProductType        AS productType,
                            i.InactiveItem = 'Y' AS inactiveItem,
                            i.SalesUnitOfMeasure AS salesUnitOfMeasure,
                            JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                            'filename', img.filename,
                                            'preferred', IF(img.preferred = 1, TRUE, FALSE)
                                    ))           AS filenames
                     FROM b2b_oscommerce.products_to_itemcodes d
                         LEFT JOIN c2.CI_Item i ON i.ItemCode = d.ItemCode AND i.Company = 'chums'
                         LEFT JOIN (SELECT DISTINCT item_code, filename, 1 AS preferred
                         FROM c2.PM_Images i
                         WHERE i.active = 1
                         UNION
                         SELECT DISTINCT ip.item_code, ip.filename, 0 AS preferred
                         FROM c2.PM_ImageProducts ip
                         INNER JOIN c2.PM_Images i ON i.filename = ip.filename
                         WHERE ip.active = 1) img ON img.item_code = d.ItemCode
                     WHERE (IFNULL(:filename, '') = '' OR img.filename REGEXP :filename)
                       AND (IFNULL(:itemCode, '') = '' OR d.ItemCode REGEXP :itemCode)
                       AND (IFNULL(:missing, '0') = '0' OR img.filename IS NULL)
                     GROUP BY d.productsID, d.keyword, d.ItemCode, d.active, i.ItemCodeDesc, i.ProductType,
                         i.InactiveItem,
                         i.SalesUnitOfMeasure
                         
                         UNION

                     SELECT p.products_id        AS productId,
                            p.products_keyword   AS keyword,
                            pi.itemCode,
                            pi.active,
                            i.ItemCodeDesc       AS itemCodeDesc,
                            i.ProductType        AS productType,
                            i.InactiveItem = 'Y' AS inactiveItem,
                            i.SalesUnitOfMeasure AS salesUnitOfMeasure,
                            JSON_ARRAY(JSON_OBJECT(
                                    'filename', JSON_EXTRACT(pi.additionalData, '$.image_filename'),
                                    'preferred', FALSE
                                       ))
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.products_items pi ON pi.productsID = p.products_id
                              INNER JOIN c2.CI_Item i ON i.ItemCode = pi.itemCode AND i.Company = 'chums'
                     WHERE JSON_EXTRACT(additionalData, '$.image_filename') LIKE '%missing%'
                       AND pi.active = 1
                       and p.products_status = 1
                       
                   ORDER BY keyword, itemCode`;
        const args = {
            filename: options.filename ?? null,
            itemCode: options.itemCode ?? null,
            missing: options.missing ? 1 : 0
        };
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => ({
            ...row,
            active: row.active === 1,
            inactiveItem: row.inactiveItem === 1,
            filenames: JSON.parse(row.filenames),
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadProductImages()", err.message);
            return Promise.reject(err);
        }
        debug("loadProductImages()", err);
        return Promise.reject(new Error('Error in loadProductImages()'));
    }
}
export const getProductImageValidation = async (req, res) => {
    try {
        const args = {
            filename: req.query.filename ?? null,
            itemCode: req.query.itemCode ?? null,
            missing: req.query.missing === '1',
        };
        const items = await loadProductImages(args);
        res.json(items);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getProductImageValidation()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getProductImageValidation' });
    }
};
export const renderProductImageValidationTable = async (req, res) => {
    try {
        const args = {
            filename: req.query.filename ?? null,
            itemCode: req.query.itemCode ?? null,
            missing: req.query.missing === '1',
        };
        const items = await loadProductImages(args);
        res.render('product-image-validation-table.pug', { items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderProductImageValidationTable()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in renderProductImageValidationTable' });
    }
};
