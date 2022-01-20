'use strict';

const debug = require('debug')('chums:lib:product:v2:product');
const {mysql2Pool} = require('chums-local-modules');
const utils = require('./utils');
const mix = require('./mix');
const item = require('./item');
const images = require('./images');

async function load({id, keyword, complete = false}) {
    try {
        const query = `SELECT p.products_id                      AS id,
                              p.products_model                   AS itemCode,
                              p.products_keyword                 AS keyword,
                              d.products_name                    AS name,
                              d.products_meta_title              AS metaTitle,
                              products_description               AS description,
                              products_details                   AS details,
                              p.products_image                   AS image,
                              p.products_status                  AS status,
                              p.products_tax_class_id            AS taxClassId,
                              p.manufacturers_id                 AS manufacturersId,
                              p.materials_id                     AS materialsId,
                              p.products_sell_as                 AS sellAs,
                              IFNULL(ci.UDF_UPC, p.products_upc) AS upc,
                              p.products_default_color           AS defaultColor,
                              p.default_categories_id            AS defaultCategoriesId,
                              (
                              SELECT page_keyword
                              FROM b2b_oscommerce.category_pages
                              WHERE categorypage_id = p.default_categories_id
                              )                                  AS defaultCategoryKeyword,
                              p.default_parent_products_id       AS defaultParentProductsId,
                              p.options,
                              p.required_options                 AS requireOptions,
                              p.can_dome                         AS canDome,
                              p.can_screen_print                 AS canScreenPrint,
                              p.available_for_sale               AS availableForSale,
                              p.products_date_available          AS dateAvailable,
                              p.timestamp,
                              ci.SuggestedRetailPrice            AS msrp,
                              ci.StandardUnitPrice               AS stdPrice,
                              ci.PriceCode                       AS priceCode,
                              ci.StandardUnitOfMeasure           AS stdUM,
                              ci.SalesUnitOfMeasure              AS salesUM,
                              ci.SalesUMConvFctr                 AS salesUMFactor,
                              ci.ShipWeight                      AS shipWeight,
                              ci.ProductType                     AS productType,
                              w.QuantityAvailable,
                              IF(ci.InactiveItem = 'Y', 1, 0)    AS inactiveItem,
                              w.buffer,
                              p.redirect_to_parent               AS redirectToParent,
                              (
                              SELECT products_keyword
                              FROM b2b_oscommerce.products
                              WHERE products_id = p.default_parent_products_id
                              )                                  AS parentProductKeyword,
                              p.additional_data                  AS additionalData,
                              p.product_season_id,
                              s.code                             AS season_code,
                              s.description                      AS season_description,
                              s.active                           AS season_active,
                              s.product_available                AS season_available,
                              s.product_teaser                   AS season_teaser
                       FROM b2b_oscommerce.products p
                            INNER JOIN b2b_oscommerce.products_description d
                                       ON d.products_id = p.products_id AND d.language_id = 1
                            LEFT JOIN  b2b_oscommerce.manufacturers m
                                       ON p.manufacturers_id = m.manufacturers_id
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
        const [[product = {}]] = await mysql2Pool.query(query, data);

        product.QuantityAvailable = Number(product.QuantityAvailable);
        product.redirectToParent = !!product.redirectToParent;
        product.additionalData = JSON.parse(product.additionalData || '{}');
        product.season_available = !!product.season_available;
        if (complete) {
            product.variants = await loadVariants({productId: product.id});
        }
        product.mix = utils.checkSellAs(product.sellAs, utils.SELL_AS.MIX) ? await mix.loadMix({id: product.id}) : null;
        product.items = utils.checkSellAs(product.sellAs, utils.SELL_AS.COLOR) ? await item.loadItems({productId: product.id}) : [];
        product.images = await images.loadImages({productId: product.id});
        return product;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
}

exports.load = load;

/**
 *
 * @param {Object} params
 * @param {number} params.id
 * @param {string} params.keyword
 * @param {string} params.itemCode
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
 * @param {object} params.additionalData
 * @param {object} params.name
 */
async function saveProduct(params) {
    try {
        let {id, keyword} = params;
        id = Number(id || 0);
        if (id === 0 && !keyword) {
            return Promise.reject(new Error('Keyword is required'));
        }

        if (id === 0) {
            id = await addProduct(params);
        }
        const product = await load({id});
        if (product.keyword !== keyword) {
            const p2 = await load({keyword});
            if (p2) {
                return Promise.reject(new Error(`Keyword '${keyword}' already exists.`));
            }
        }
        const query = `UPDATE b2b_oscommerce.products
                       SET products_keyword           = :keyword,
                           products_model             = :itemCode,
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
                           products_date_available    = :dateAvailable,
                           additional_data            = :additionalData,
                           product_season_id          = :product_season_id
                       WHERE products_id = :id`;
        const queryDescription = `UPDATE b2b_oscommerce.products_description
                                  SET products_name        = :name,
                                      products_meta_title  = :metaTitle,
                                      products_description = :description,
                                      products_details     = :details`;
        const data = {
            ...product,
            ...params,
            id,
            additionalData: JSON.stringify(params.additionalData || {}),
        };
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        await connection.query(queryDescription, data);
        connection.release();
        return await load({id});
    } catch (err) {
        debug("saveProduct()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} keyword
 */
async function addProduct({keyword}) {
    try {
        const product = await load({keyword});
        if (product) {
            const error = new Error(`Error: keyword '${keyword}' already exists`);
            return Promise.reject(error);
        }
        const queryProduct = `INSERT INTO b2b_oscommerce.products
                                  (products_model, products_date_added)
                              VALUES (:keyword, NOW())`;
        const queryDescription = `INSERT INTO b2b_oscommerce.products_description (products_id) VALUES (:id)`;
        const connection = await mysql2Pool.getConnection();
        const [{insertId}] = await connection.query(queryProduct, {keyword});
        await connection.query(queryDescription, {id: insertId});
        connection.release();
        return insertId;
    } catch (err) {
        debug("addProduct()", err.message);
        return Promise.reject(err);
    }
}

async function loadVariants({productId, id}) {
    try {
        const query = `SELECT v.id,
                              v.productID AS parentProductID,
                              v.variantProductID,
                              v.title,
                              v.isDefaultVariant,
                              v.active    AS status,
                              v.priority,
                              v.timestamp
                       FROM b2b_oscommerce.products_variants v
                            INNER JOIN b2b_oscommerce.products p
                                       ON p.products_id = v.variantProductID
                       WHERE productId = :productId
                         AND (id = :id OR :id IS NULL)`;
        const data = {productId, id};
        const [rows] = await mysql2Pool.query(query, data);

        const products = await Promise.all(rows.map(row => {
            const {variantProductID} = row;
            return load({id: variantProductID});
        }));
        rows.forEach(row => {
            const [product] = products.filter(product => product.id === row.variantProductID);
            row.product = product;
        });
        return rows;
    } catch (err) {
        debug("loadVariant()", err.message);
        return Promise.reject(err);
    }
}


async function get(req, res) {
    try {
        const {id, keyword} = req.params;
        const product = await load({id, keyword, complete: !!keyword});
        if (!product) {
            return res.status(404).json({error: 'product not found'});
        }
        res.json({products: [product]});
    } catch (err) {
        debug("getByID()", err.message);
        res.json({error: err.message});
    }
}


async function post(req, res) {
    try {
        const params = {
            ...req.body,
        };
        debug('post()', params);
        res.json({body: req.body});
        return;
        const product = await saveProduct(params);
        res.json({product});
    } catch (err) {
        debug("post()", err.message);
        return res.json({error: err.message});
    }
}


exports.get = get;
exports.getByID = get;
exports.post = post;

