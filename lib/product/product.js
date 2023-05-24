import Debug from "debug";

const debug = Debug('chums:lib:product:product');
import {mysql2Pool} from 'chums-local-modules';
import {loadMaterials} from './materials.js';



export async function load({id, keyword}) {
    try {
        const query = `SELECT p.products_id                   AS id,
                              p.products_model                AS itemCode,
                              p.products_keyword              AS keyword,
                              d.products_name                 AS name,
                              d.products_meta_title           AS metaTitle,
                              products_description            AS description,
                              products_details                AS details,
                              p.products_image                AS image,
                              p.products_status               AS status,
                              p.products_tax_class_id         AS taxClassId,
                              p.manufacturers_id              AS manufacturersId,
                              p.materials_id                  AS materialsId,
                              p.products_sell_as              AS sellAs,
                              p.products_upc                  AS upc,
                              p.products_default_color        AS defaultColor,
                              p.default_categories_id         AS defaultCategoriesId,
                              c.page_keyword                  AS defaultCategoryKeyword,
                              p.default_parent_products_id    AS defaultParentProductsId,
                              p.options,
                              p.required_options              AS requireOptions,
                              p.can_dome                      AS canDome,
                              p.can_screen_print              AS canScreenPrint,
                              p.available_for_sale            AS availableForSale,
                              p.products_date_available       AS dateAvailable,
                              p.timestamp,
                              ci.SuggestedRetailPrice         AS msrp,
                              ci.StandardUnitPrice            AS stdPrice,
                              ci.PriceCode                    AS priceCode,
                              ci.StandardUnitOfMeasure        AS stdUM,
                              ci.SalesUnitOfMeasure           AS salesUM,
                              ci.SalesUMConvFctr              AS salesUMFactor,
                              ci.ShipWeight                   AS shipWeight,
                              ci.ProductType                  AS productType,
                              w.QuantityAvailable,
                              IF(ci.InactiveItem = 'Y', 1, 0) AS inactiveItem,
                              w.buffer,
                              p.redirect_to_parent            AS redirectToParent,
                              (
                              SELECT products_keyword
                              FROM b2b_oscommerce.products
                              WHERE products_id = p.default_parent_products_id
                              )                               AS parentProductKeyword,
                              p.additional_data               AS additionalData,
                              p.product_season_id,
                              s.code                          AS season_code,
                              s.description                   AS season_description,
                              s.active                        AS season_active,
                              s.product_teaser                AS season_teaser
                       FROM b2b_oscommerce.products p
                            INNER JOIN b2b_oscommerce.products_description d
                                       ON d.products_id = p.products_id AND d.language_id = 1
                            LEFT JOIN  b2b_oscommerce.manufacturers m
                                       ON p.manufacturers_id = m.manufacturers_id
                            LEFT JOIN  b2b_oscommerce.category_pages c
                                       ON c.categorypage_id = p.default_categories_id
                            LEFT JOIN  c2.ci_item ci
                                       ON ci.Company = m.company AND ci.ItemCode = p.products_model
                            LEFT JOIN  c2.v_web_available w
                                       ON w.Company = ci.company
                                           AND w.ItemCode = ci.ItemCode
                                           AND w.WarehouseCode = ci.DefaultWarehouseCode
                            LEFT JOIN  b2b_oscommerce.product_seasons s
                                       USING (product_season_id)
                       WHERE p.products_id = :id
                          OR p.products_keyword = :keyword`;
        const data = {id, keyword};
        const [rows] = await mysql2Pool.query(query, data);

        rows.map(row => {
            row.additionalData = JSON.parse(row.additionalData || '{}');
            row.QuantityAvailable = Number(row.QuantityAvailable || '0');
            row.redirectToParent = row.redirectToParent === 1;
        });
        return rows;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
}

const loadProductList = async ({mfg = '%'}) => {
    try {
        const query = `SELECT p.products_id,
                              pd.products_name,
                              p.products_model,
                              p.products_keyword,
                              p.products_image,
                              p.products_status,
                              p.default_parent_products_id      AS parent_id,
                              (
                              SELECT COUNT(*)
                              FROM b2b_oscommerce.products_variants
                              WHERE productID = p.products_id)  AS variants_count,
                              (
                              SELECT COUNT(*)
                              FROM b2b_oscommerce.products_mixes
                              WHERE productsID = p.products_id) AS mixes_count,
                              (
                              SELECT COUNT(*)
                              FROM b2b_oscommerce.products_items
                              WHERE productsID = p.products_id) AS colors_count,
                              p.redirect_to_parent,
                              p.available_for_sale,
                              price.minPrice,
                              price.maxPrice,
                              cs.specials_new_products_price    AS salePrice,
                              p.product_season_id,
                              s.code                            AS season_code,
                              s.description                     AS season_description,
                              s.active                          AS season_active
                       FROM b2b_oscommerce.products p
                            INNER JOIN b2b_oscommerce.products_description pd
                                       ON pd.products_id = p.products_id AND pd.language_id = 1
                            LEFT JOIN  (
                                       SELECT pi.productsId,
                                              MIN(SuggestedRetailPrice * SalesUMConvFctr) AS minPrice,
                                              MAX(suggestedRetailPrice * SalesUMConvFctr) AS maxPrice
                                       FROM b2b_oscommerce.products_to_itemcodes pi
                                            LEFT JOIN c2.ci_item i
                                                      ON i.company = pi.company AND i.ItemCode = pi.ItemCode
                                       WHERE NOT (i.ProductType = 'D' OR i.InactiveItem = 'Y')
                                       GROUP BY pi.productsID) AS price
                                       ON price.productsID = p.products_id
                            LEFT JOIN  b2b_oscommerce.current_specials cs
                                       ON cs.products_id = p.products_id
                            LEFT JOIN  b2b_oscommerce.product_seasons s
                                       USING (product_season_id)
                       WHERE p.manufacturers_id LIKE :mfg
                       ORDER BY pd.products_name`;
        const data = {mfg};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadProductList()", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {Object} params
 * @param {number} params.id
 * @param {string} params.itemCode
 * @param {string} params.keyword
 * @param {string} params.image
 * @param {number} params.status
 * @param {number} params.taxClassId
 * @param {number} params.manufacturersId
 * @param {number} params.materialsId
 * @param {number} params.sellAs
 * @param {string} params.upc
 * @param {string} params.defaultColor
 * @param {number} params.defaultCategoriesId
 * @param {number} params.defaultParentProductsId
 * @param {string} params.options
 * @param {string} params.requiredOptions
 * @param {number} params.canDome
 * @param {number} params.canScreenPrint
 * @param {number} params.availableForSale
 * @param {string} params.dateAvailable
 */
async function saveProduct(params) {
    try {
        const {
            itemCode, keyword, image, status, taxClassId, manufacturersId, materialsId,
            sellAs, upc, defaultColor, defaultCategoriesId, defaultParentProductsId,
            options, requiredOptions, canDome, canScreenPrint, availableForSale, dateAvailable, id
        } = params;
        const sql = `UPDATE b2b_oscommerce.products
                     SET products_model             = :itemCode,
                         products_keyword           = :keyword,
                         products_image             = :image,
                         products_status            = :status,
                         products_tax_class_id      = :taxClassId,
                         manufacturers_id           = :manufacturersId,
                         materials_id               = :materialsId,
                         products_sell_as           = :sellAs,
                         products_upc               = :upc,
                         products_default_color     = :defaultColor,
                         default_categories_id      = :defaultCategoriesId,
                         default_parent_products_id = :defaultParentProductsId,
                         options                    = :options,
                         required_options           = :requiredOptions,
                         can_dome                   = :canDome,
                         can_screen_print           = :canScreenPrint,
                         available_for_sale         = :availableForSale,
                         products_date_available    = :dateAvailable
                     WHERE products_id = :id`;
        const data = {
            itemCode, keyword, image, status, taxClassId, manufacturersId, materialsId,
            sellAs, upc, defaultColor, defaultCategoriesId, defaultParentProductsId,
            options: JSON.stringify(options || []),
            requiredOptions: JSON.stringify(requiredOptions || []),
            canDome: canDome || 0, canScreenPrint: canScreenPrint || 0,
            availableForSale: availableForSale || 0, dateAvailable, id
        };
        await mysql2Pool.query(sql, data);
        return id;
    } catch (err) {
        debug("saveProduct()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {number|string} params.id
 * @param {string} params.itemCode
 * @param {string} params.keyword
 * @param {string} params.image
 * @param {number|string} params.status
 * @param {number|string} params.taxClassId
 * @param {number|string} params.manufacturersId
 * @param {number|string} params.materialsId
 * @param {number|string} params.sellAs
 * @param {string} params.upc
 * @param {string} params.defaultColor
 * @param {number|string} params.defaultCategoriesId
 * @param {number|string} params.defaultParentProductsId
 * @param {string} params.options
 * @param {string} params.requiredOptions
 * @param {number|string} params.canDome
 * @param {number|string} params.canScreenPrint
 * @param {number|string} params.availableForSale
 * @param {string} params.dateAvailable
 * @param {string?} params.name
 * @param {string?} params.metaTitle
 * @param {string?} params.description
 * @param {string?} params.details
 */
async function addProduct(params) {
    try {
        const {
            itemCode, keyword, image, status, taxClassId, manufacturersId, materialsId,
            sellAs, upc, defaultColor, defaultCategoriesId, defaultParentProductsId,
            options, requiredOptions, canDome, canScreenPrint, availableForSale, dateAvailable, id
        } = params;
        const sql = `INSERT INTO b2b_oscommerce.products
                     (products_model, products_keyword, products_image, products_status, products_tax_class_id,
                      manufacturers_id, materials_id, products_sell_as, products_upc, products_default_color,
                      default_categories_id, default_parent_products_id, options,
                      required_options, can_dome, can_screen_print,
                      available_for_sale, products_date_available)
                     VALUES (:itemCode, :keyword, :image, :status, :taxClassId, :manufacturersId, :materialsId, :sellAs,
                             :upc, :defaultColoir, :defaultCategoriesId, :defaultParentProductsId, :options,
                             :requiredOptions, :canDome, :canScreenPrint, :availableForSale, :dateAvailable)`;
        const data = {
            itemCode,
            keyword,
            image,
            status,
            taxClassId,
            manufacturersId,
            materialsId,
            sellAs,
            upc,
            defaultColor,
            defaultParentProductsId,
            options: JSON.stringify(options || []),
            requiredOptions: JSON.stringify(requiredOptions || []),
            canDome: canDome || 0,
            canScreenPrint: canScreenPrint || 0,
            availableForSale: availableForSale || 0,
            dateAvailable
        };
        const [{insertId}] = await mysql2Pool.query(sql, data);
        return insertId;
    } catch (err) {
        debug("addProduct()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {number} params.id
 * @param {string} params.name
 * @param {string} params.metaTitle
 * @param {string} params.description
 * @param {string} params.details
 */

async function saveProductText(params) {
    try {
        const {id, name, metaTitle, description, details} = params;
        const sql = `UPDATE b2b_oscommerce.products_description
                     SET products_name        = :name,
                         products_meta_title  = :metaTitle,
                         products_description = :description,
                         products_details     = :details
                     WHERE products_id = :id
                       AND language_id = 1`;
        const args = {id, name, metaTitle: metaTitle || '', description: description || '', details: details || ''};
        await mysql2Pool.query(sql, args);
        return id;
    } catch (err) {
        debug("saveProductText()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {number} params.id
 * @param {string} params.name
 * @param {string} params.metaTitle
 * @param {string} params.description
 * @param {string} params.details
 */
async function addProductText(params) {
    try {
        const {id, name, metaTitle, description, details} = params;
        const sql = `INSERT INTO b2b_oscommerce.products_description
                     SET products_id          = :id,
                         language_id          = 1,
                         products_name        = :name,
                         products_meta_title  = :metaTitle,
                         products_description = :description,
                         products_details     = :details`;
        const args = {id, name, metaTitle: metaTitle || '', description: description || '', details: details || ''};
        await mysql2Pool.query(sql, args);
        return id;
    } catch (err) {
        debug("addProductText()", err.message);
        return Promise.reject(err);
    }
}

export async function getProduct(req, res, next) {
    try {
        const params = {
            id: req.params.id || res.locals.productId,
            keyword: req.params.keyword
        };
        const products = await load(params);
        res.locals.response = {products: products};
    } catch (err) {
        debug("get()", err.message);
        res.locals.response = {error: err.message};
    }
    next();
}


export async function postProduct(req, res, next) {
    try {
        const {
            id, itemCode, keyword, image, status, taxClassId, manufacturersId, materialsId, defaultCategoriesId,
            defaultParentProductsId, options, requiredOptions, canDome, canScreenPrint, availableForSales,
            dateAvailable, name, metaTitle, description, details,
        } = req.body;
        const params = {
            id, itemCode, keyword, image, status, taxClassId, manufacturersId, materialsId, defaultCategoriesId,
            defaultParentProductsId, options, requiredOptions, canDome, canScreenPrint, availableForSales,
            dateAvailable, name, metaTitle, description, details,
        };
        if (!id || id === 0) {
            params.id = await addProduct(params);
            await addProductText(params);
        } else {
            await saveProduct(params);
            await saveProductText(params);
        }
        res.locals.productId = params.id;
    } catch (err) {
        debug("post()", err.message);
        res.locals.error = err.message;
        next(err.message);
    }
}

export async function getProductMaterials(req, res, next) {
    try {
        if (!res.locals || !res.locals.response || !res.locals.response.products || res.locals.response.products.length === 0) {
            return next();
        }
        const params = {
            id: res.locals.response.products[0].materialsId
        };
        const materials = await loadMaterials(params);
        res.locals.response.products[0].materials = materials[0] ?? {};
        next();
    } catch (err) {
        debug("getMaterials()", err.message);
        res.status(500).json({error: err.message});
        return next();
    }
}







// exports.getItems = item.get;
// exports.getItemCodes = itemCodes.get;
// exports.getItemQty = itemQuantity.get;


export const getProductList = async (req, res) => {
    try {
        const products = await loadProductList(req.params);
        res.json({products});
    } catch (err) {
        debug("getList()", err.message);
        res.json({error: err.message});
    }
};
