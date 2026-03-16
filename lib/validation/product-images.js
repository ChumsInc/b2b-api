import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:validation:product-images');
async function loadProductImages(options) {
    try {
        const sql = `                                    
                     SELECT 
                            -- products without valid images or inactive images
                            d.productsID         AS productId,
                            d.keyword,
                            d.ItemCode           AS itemCode,
                            d.active,
                            i.ItemCodeDesc       AS itemCodeDesc,
                            i.ProductType        AS productType,
                            i.InactiveItem = 'Y' AS inactiveItem,
                            i.SalesUnitOfMeasure AS salesUnitOfMeasure,
                            JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                            'filename', p.products_image,
                                            'active', img.active = 1,
                                            'preferred', IF(img.preferred_image = 1, TRUE, FALSE)
                                    ))           AS filenames
                     FROM b2b_oscommerce.products_to_itemcodes d
                              INNER JOIN c2.CI_Item i ON i.ItemCode = d.ItemCode AND i.Company = 'chums'
                              INNER JOIN b2b_oscommerce.products p ON p.products_id = d.productsID
                              LEFT JOIN c2.PM_Images img ON img.filename = p.products_image
                     WHERE IFNULL(img.active, 0) = 0
                     GROUP BY d.productsID, d.keyword, d.ItemCode, d.active, i.ItemCodeDesc, i.ProductType,
                              i.InactiveItem,
                              i.SalesUnitOfMeasure

                     UNION
                     
                     -- items without images or inactive images
                     SELECT d.productsID         AS productId,
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
                                            'active', img.active = 1,
                                            'preferred', IF(img.preferred_image = 1, TRUE, FALSE)
                                    ))           AS filenames
                     FROM b2b_oscommerce.products_to_itemcodes d
                              INNER JOIN b2b_oscommerce.products p ON p.products_id = d.productsID
                              INNER JOIN b2b_oscommerce.products_items pi2
                                         ON pi2.productsID = p.products_id AND pi2.itemCode = d.itemCode
                              INNER JOIN c2.CI_Item i ON i.ItemCode = d.ItemCode AND i.Company = 'chums'
                              LEFT JOIN c2.PM_Images img ON img.filename =
                                                            IFNULL(JSON_VALUE(pi2.additionalData, '$.image_filename'),
                                                                   p.products_image)
                     WHERE IFNULL(img.active, 0) = 0
                     GROUP BY d.productsID, d.keyword, d.ItemCode, d.active, i.ItemCodeDesc, i.ProductType

                     UNION

                     -- products items with missing images
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
                                    'active', img.active = 1,
                                    'preferred', FALSE
                                       ))
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.products_items pi ON pi.productsID = p.products_id
                              INNER JOIN c2.CI_Item i ON i.ItemCode = pi.itemCode AND i.Company = 'chums'
                              LEFT JOIN c2.PM_Images img
                                        ON img.filename = JSON_VALUE(pi.additionalData, '$.image_filename')
                     WHERE pi.active = 1
                       AND p.products_status = 1                    
                       AND (JSON_EXTRACT(additionalData, '$.image_filename') LIKE '%missing%'
                         OR IFNULL(img.active, 0) = 0
                         )

                     UNION
                     -- products with missing images
                     SELECT p.products_id        AS productId,
                            p.products_keyword   AS keyword,
                            p.products_model     AS itemCode,
                            p.products_status    AS active,
                            i.ItemCodeDesc       AS itemCodeDesc,
                            i.ProductType        AS productType,
                            i.InactiveItem = 'Y' AS inactiveItem,
                            i.SalesUnitOfMeasure AS salesUnitOfMeasure,
                            JSON_ARRAY(JSON_OBJECT(
                                    'filename', p.products_image,
                                    'active', 0,
                                    'preferred', FALSE
                                       ))
                     FROM b2b_oscommerce.products p
                              INNER JOIN c2.CI_Item i ON i.ItemCode = p.products_model AND i.Company = 'chums'
                              LEFT JOIN c2.PM_Images img ON img.filename = p.products_image
                     WHERE p.products_status = 1
                       AND (p.products_image LIKE '%missing%'
                         OR IFNULL(p.products_image, '') = ''
                         OR IFNULL(img.active, 0) = 0)


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
        res.render('product-image-validation-table.ejs', { items });
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
