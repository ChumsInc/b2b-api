import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
import { loadProductItems } from "./item.js";
import { loadMix, saveMix } from "./mix.js";
import { loadImages } from "./images.js";
import { isSellAsColors, isSellAsMix, isSellAsVariants, } from './utils.js';
import { loadSeasons } from "./seasons.js";
const debug = Debug('chums:lib:product:v2:product');
async function loadList({ mfg = '%' }) {
    try {
        const query = `SELECT p.products_id                                      AS id,
                              pd.products_name                                   AS name,
                              p.products_model                                   AS itemCode,
                              p.products_keyword                                 AS keyword,
                              IFNULL(p.products_image, '')                       AS image,
                              p.products_status                                  AS status,
                              p.manufacturers_id                                 AS manufacturersId,
                              p.default_parent_products_id                       AS defaultParentProductsId,
                              p.default_categories_id                            AS defaultCategoriesId,
                              (SELECT products_keyword
                               FROM b2b_oscommerce.products
                               WHERE products_id = p.default_parent_products_id) AS parentProductKeyword,
                              p.products_sell_as                                 AS sellAs,
                              (SELECT COUNT(*)
                               FROM b2b_oscommerce.products_variants
                               WHERE productID = p.products_id)                  AS variantsCount,
                              (SELECT COUNT(*)
                               FROM b2b_oscommerce.products_variants v
                                        INNER JOIN b2b_oscommerce.products p
                                                   ON v.variantProductID = p.products_id
                               WHERE v.productID = p.products_id
                                 AND p.products_sell_as = 1
                                 AND v.active = 1
                                 AND p.products_status = 1)                      AS selfCount,
                              (SELECT COUNT(*)
                               FROM b2b_oscommerce.products_mixes m
                                        INNER JOIN b2b_oscommerce.products_variants v
                                                   ON v.variantProductID = m.productsID
                               WHERE v.productID = p.products_id
                                 AND v.active = 1
                                 AND m.active = 1)                               AS mixesCount,
                              (SELECT COUNT(*)
                               FROM b2b_oscommerce.products_items i
                                        INNER JOIN b2b_oscommerce.products_variants v
                                                   ON v.variantProductID = i.productsID
                               WHERE v.productID = p.products_id
                                 AND v.active = 1
                                 AND i.active = 1)                               AS colorsCount,
                              IFNULL(p.redirect_to_parent, 0)                    AS redirectToParent,
                              p.available_for_sale                               AS availableForSale,
                              price.minPrice,
                              price.maxPrice,
                              cs.specials_new_products_price                     AS salePrice,
                              p.product_season_id,
                              s.code                                             AS season_code,
                              JSON_EXTRACT(additional_data, '$.seasonAvailable') as seasonAvailable
                       FROM b2b_oscommerce.products p
                                INNER JOIN b2b_oscommerce.products_description pd
                                           ON pd.products_id = p.products_id AND pd.language_id = 1
                                LEFT JOIN (SELECT pi.productsId,
                                                  MIN(SuggestedRetailPrice * SalesUMConvFctr) AS minPrice,
                                                  MAX(suggestedRetailPrice * SalesUMConvFctr) AS maxPrice
                                           FROM b2b_oscommerce.products_to_itemcodes pi
                                                    LEFT JOIN c2.ci_item i
                                                              ON i.company = pi.company AND i.ItemCode = pi.ItemCode
                                           WHERE NOT (i.ProductType = 'D' OR i.InactiveItem = 'Y')
                                           GROUP BY pi.productsID) AS price
                                          ON price.productsID = p.products_id
                                LEFT JOIN b2b_oscommerce.current_specials cs
                                          ON cs.products_id = p.products_id
                                LEFT JOIN b2b_oscommerce.product_seasons s
                                          USING (product_season_id)
                       WHERE p.manufacturers_id LIKE :mfg
                       ORDER BY pd.products_id`;
        const data = { mfg };
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => {
            return {
                ...row,
                redirectToParent: !!row.redirectToParent,
                availableForSale: !!row.availableForSale,
                seasonAvailable: row.seasonAvailable === 'true' || !row.product_season_id,
                status: !!row.status,
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadList()", err.message);
            return Promise.reject(err);
        }
        debug("loadList()", err);
        return Promise.reject(new Error('Error in loadList()'));
    }
}
function parseProductRow(row) {
    const { status, availableForSale, canDome, canScreenPrint, QuantityAvailable, redirectToParent, additionalData, season_available, inactiveItem, product_season_id, season_active, ...rest } = row;
    return {
        ...rest,
        product_season_id: product_season_id,
        status: !!status,
        availableForSale: !!availableForSale,
        canDome: !!canDome,
        canScreenPrint: !!canScreenPrint,
        QuantityAvailable: Number(QuantityAvailable),
        redirectToParent: !!redirectToParent,
        additionalData: JSON.parse(additionalData || '{}'),
        season_available: !!season_available,
        inactiveItem: !!inactiveItem,
        season_active: !!product_season_id ? !!season_active : null
    };
}
export async function loadProduct({ id, keyword, complete = false }) {
    try {
        const query = `SELECT p.products_id                                      AS id,
                              p.products_model                                   AS itemCode,
                              p.products_keyword                                 AS keyword,
                              d.products_name                                    AS name,
                              d.products_meta_title                              AS metaTitle,
                              products_description                               AS description,
                              products_details                                   AS details,
                              p.products_image                                   AS image,
                              p.products_status                                  AS status,
                              p.products_tax_class_id                            AS taxClassId,
                              p.manufacturers_id                                 AS manufacturersId,
                              p.materials_id                                     AS materialsId,
                              p.products_sell_as                                 AS sellAs,
                              IFNULL(ci.UDF_UPC, p.products_upc)                 AS upc,
                              p.products_default_color                           AS defaultColor,
                              p.default_categories_id                            AS defaultCategoriesId,
                              (SELECT page_keyword
                               FROM b2b_oscommerce.category_pages
                               WHERE categorypage_id = p.default_categories_id)  AS defaultCategoryKeyword,
                              p.default_parent_products_id                       AS defaultParentProductsId,
                              p.options,
                              p.required_options                                 AS requireOptions,
                              p.can_dome                                         AS canDome,
                              p.can_screen_print                                 AS canScreenPrint,
                              p.available_for_sale                               AS availableForSale,
                              p.products_date_available                          AS dateAvailable,
                              p.timestamp,
                              IFNULL(ci.SuggestedRetailPrice, p.products_price)  AS msrp,
                              ci.StandardUnitPrice                               AS stdPrice,
                              ci.PriceCode                                       AS priceCode,
                              ci.StandardUnitOfMeasure                           AS stdUM,
                              ci.SalesUnitOfMeasure                              AS salesUM,
                              ci.SalesUMConvFctr                                 AS salesUMFactor,
                              ci.ShipWeight                                      AS shipWeight,
                              ci.ProductType                                     AS productType,
                              w.QuantityAvailable,
                              IF(ci.InactiveItem = 'Y', 1, 0)                    AS inactiveItem,
                              w.buffer,
                              p.redirect_to_parent                               AS redirectToParent,
                              (SELECT products_keyword
                               FROM b2b_oscommerce.products
                               WHERE products_id = p.default_parent_products_id) AS parentProductKeyword,
                              p.additional_data                                  AS additionalData,
                              p.product_season_id,
                              s.code                                             AS season_code,
                              s.description                                      AS season_description,
                              s.active                                           AS season_active,
                              s.product_available                                AS season_available,
                              s.product_teaser                                   AS season_teaser,
                              s.preseason_message                                AS preSeasonMessage,
                              p.products_price                                   AS anticipatedPrice,
                              ia.ItemStatus                                      AS productStatus
                       FROM b2b_oscommerce.products p
                                INNER JOIN b2b_oscommerce.products_description d
                                           ON d.products_id = p.products_id AND d.language_id = 1
                                LEFT JOIN b2b_oscommerce.manufacturers m
                                          ON p.manufacturers_id = m.manufacturers_id
                                LEFT JOIN c2.ci_item ci
                                          ON ci.Company = m.company AND ci.ItemCode = p.products_model
                                LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                          ON ia.company = ci.company
                                              AND ia.ItemCode = ci.ItemCode
                                              AND ia.WarehouseCode = ci.DefaultWarehouseCode
                                LEFT JOIN c2.v_web_available w
                                          ON w.Company = ci.company
                                              AND w.ItemCode = ci.ItemCode
                                              AND w.WarehouseCode = ci.DefaultWarehouseCode
                                LEFT JOIN b2b_oscommerce.product_seasons s
                                          ON s.product_season_id = p.product_season_id
                       WHERE p.products_id = :id
                          OR p.products_keyword = :keyword`;
        const data = { id, keyword };
        const [[productRow]] = await mysql2Pool.query(query, data);
        if (!productRow) {
            return;
        }
        const product = parseProductRow(productRow);
        product.images = await loadImages({ productId: product.id });
        if (product.product_season_id) {
            const [season] = await loadSeasons({ id: product.product_season_id });
            product.season = season ?? null;
            product.season_active = !!product.season_active;
        }
        let variants = [];
        if (complete) {
            variants = await loadVariants({ productId: productRow.id });
        }
        if (isSellAsMix(product)) {
            const mix = await loadMix(product.id);
            if (mix) {
                product.mix = mix;
            }
        }
        if (isSellAsColors(product)) {
            product.items = await loadProductItems({ productId: productRow.id });
        }
        if (isSellAsVariants(product)) {
            product.variants = variants;
        }
        return product;
        // let mix = checkSellAs(productRow.sellAs, SELL_AS.MIX) ? await loadMix(productRow.id) : null;
        // let items = checkSellAs(productRow.sellAs, SELL_AS.COLOR) ? await loadProductItems({productId: productRow.id}) : [];
        // let images = await loadImages({productId: productRow.id});
        //
        // return {
        //     ...productRow,
        //     status: !!productRow.status,
        //     availableForSale: !!productRow.availableForSale,
        //     canDome: !!productRow.canDome,
        //     canScreenPrint: !!productRow.canScreenPrint,
        //     QuantityAvailable: Number(productRow.QuantityAvailable),
        //     redirectToParent: !!productRow.redirectToParent,
        //     additionalData: JSON.parse(productRow.additionalData || '{}'),
        //     season_available: !!productRow.season_available,
        //     inactiveItem: !!productRow.inactiveItem,
        //     season_active: !!productRow.product_season_id ? !!productRow.season_active : null,
        //     variants: complete ? variants : undefined,
        //     mix,
        //     items,
        //     images
        //
        // }
    }
    catch (err) {
        if (err instanceof Error) {
            debug("load()", err.message);
            return Promise.reject(err);
        }
        debug("load()", err);
        return Promise.reject(new Error('Error in load()'));
    }
}
export async function saveProduct(params) {
    try {
        let { id, keyword } = params;
        id = Number(id || 0);
        if (id === 0 && !keyword) {
            return Promise.reject(new Error('Keyword is required'));
        }
        if (id === 0) {
            id = await addProduct(params);
        }
        const _product = await loadProduct({ id });
        // make sure that the keyword does not already exist if renaming a product keyword
        if (_product?.keyword !== keyword) {
            const p2 = await loadProduct({ keyword });
            if (p2) {
                return Promise.reject(new Error(`Keyword '${keyword}' already exists.`));
            }
        }
        const product = { ..._product, ...params, id };
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
                           product_season_id          = :product_season_id,
                           redirect_to_parent         = :redirectToParent
                       WHERE products_id = :id`;
        const queryDescription = `UPDATE b2b_oscommerce.products_description
                                  SET products_name        = :name,
                                      products_meta_title  = :metaTitle,
                                      products_description = :description,
                                      products_details     = :details
                                  WHERE products_id = :id`;
        const data = {
            ...product,
            additionalData: JSON.stringify(params.additionalData || {}),
        };
        await mysql2Pool.query(query, data);
        await mysql2Pool.query(queryDescription, data);
        if (isSellAsMix(product)) {
            if (!product.mix) {
                const mix = await saveMix({
                    productId: product.id,
                    itemCode: params.itemCode,
                    mixName: params.name,
                    status: true,
                });
                if (mix) {
                    product.mix = mix;
                }
            }
            if (product.mix && product.mix.itemCode !== product.itemCode) {
                await saveMix({
                    ...product.mix,
                    itemCode: product.itemCode
                });
            }
        }
        return await loadProduct({ id, complete: true });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveProduct()", err.message);
            return Promise.reject(err);
        }
        debug("saveProduct()", err);
        return Promise.reject(new Error('Error in saveProduct()'));
    }
}
async function addProduct({ keyword }) {
    try {
        const product = await loadProduct({ keyword });
        if (product) {
            return Promise.reject(new Error(`Error: keyword '${keyword}' already exists`));
        }
        const queryProduct = `INSERT INTO b2b_oscommerce.products
                                  (products_keyword, products_date_added)
                              VALUES (:keyword, NOW())`;
        const queryDescription = `INSERT INTO b2b_oscommerce.products_description (products_id)
                                  VALUES (:id)`;
        const connection = await mysql2Pool.getConnection();
        const [{ insertId }] = await connection.query(queryProduct, { keyword });
        await connection.query(queryDescription, { id: insertId });
        connection.release();
        return insertId;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("addProduct()", err.message);
            return Promise.reject(err);
        }
        debug("addProduct()", err);
        return Promise.reject(new Error('Error in addProduct()'));
    }
}
async function loadVariants({ productId, id }) {
    try {
        const query = `SELECT v.id,
                              v.productID                      AS parentProductID,
                              v.variantProductID,
                              v.title,
                              v.isDefaultVariant,
                              (v.active AND p.products_status) AS status,
                              v.priority,
                              v.timestamp
                       FROM b2b_oscommerce.products_variants v
                                INNER JOIN b2b_oscommerce.products p
                                           ON p.products_id = v.variantProductID
                       WHERE productId = :productId
                         AND (id = :id OR :id IS NULL)`;
        const data = { productId, id };
        const [rows] = await mysql2Pool.query(query, data);
        const products = await Promise.all(rows.map(row => {
            const { variantProductID } = row;
            return loadProduct({ id: variantProductID });
        }));
        return rows
            .map(row => {
            const [product] = products.filter(product => product?.id === row.variantProductID);
            return {
                ...row,
                isDefaultVariant: !!row.isDefaultVariant,
                status: !!row.status && !!product?.status,
                product: product,
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadVariants()", err.message);
            return Promise.reject(err);
        }
        debug("loadVariants()", err);
        return Promise.reject(new Error('Error in loadVariants()'));
    }
}
async function setDefaultVariant(params) {
    try {
        const { productId, variantId } = params;
        if (!productId || !variantId) {
            return Promise.reject(new Error('Must have a valid productID and variantId'));
        }
        const sqlClearDefault = `UPDATE b2b_oscommerce.products_variants
                                 SET isDefaultVariant = 0
                                 WHERE productID = :productId`;
        const sqlSetDefault = `UPDATE b2b_oscommerce.products_variants
                               SET isDefaultVariant = 1
                               WHERE productID = :productId
                                 AND id = :variantId`;
        await mysql2Pool.query(sqlClearDefault, { productId, variantId });
        await mysql2Pool.query(sqlSetDefault, { productId, variantId });
        return await loadVariants({ productId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("setDefaultVariant()", err.message);
            return Promise.reject(err);
        }
        debug("setDefaultVariant()", err);
        return Promise.reject(new Error('Error in setDefaultVariant()'));
    }
}
async function saveNewVariant(variant) {
    try {
        if (!variant) {
            return Promise.reject(new Error('variant.js::saveNew() missing parameters'));
        }
        const { parentProductID, variantProductID, title, status } = variant;
        const prioritySQL = `SELECT IFNULL(MAX(priority), -1) + 1 as nextPriority
                              FROM b2b_oscommerce.products_variants
                              WHERE productID = :parentProductID`;
        const [rows] = await mysql2Pool.query(prioritySQL, { parentProductID });
        const sql = `INSERT INTO b2b_oscommerce.products_variants (productID, variantProductID, title, active, priority)
                     VALUES (:parentProductID, :variantProductID, :title, :active, :priority)`;
        const args = { parentProductID, variantProductID, title, active: status, priority: rows[0].nextPriority ?? 0 };
        const [{ insertId }] = await mysql2Pool.query(sql, args);
        const [_variant] = await loadVariants({ productId: parentProductID, id: insertId });
        return _variant;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveNew()", err.message);
            return Promise.reject(err);
        }
        debug("saveNew()", err);
        return Promise.reject(new Error('Error in saveNew()'));
    }
}
async function saveVariant(variant) {
    try {
        if (!variant) {
            return Promise.reject(new Error('variant.js::save() missing parameters'));
        }
        if (!variant.id) {
            return saveNewVariant(variant);
        }
        const { id, status, priority, title, variantProductID } = variant;
        const sql = `UPDATE b2b_oscommerce.products_variants
                     SET title    = :title,
                         active   = :status,
                         priority = :priority,
                         variantProductID = :variantProductID
                     WHERE id = :id`;
        const args = { id, title, status, priority, variantProductID };
        await mysql2Pool.query(sql, args);
        const [_variant] = await loadVariants({ productId: variant.parentProductID, id: variant.id });
        return _variant;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("save()", err.message);
            return Promise.reject(err);
        }
        debug("save()", err);
        return Promise.reject(new Error('Error in save()'));
    }
}
async function updateVariantSort(productId, variants) {
    try {
        const sql = `UPDATE b2b_oscommerce.products_variants
                     SET priority = :priority
                     WHERE productID = :parentProductID
                       AND id = :id`;
        for await (const variant of variants) {
            await mysql2Pool.query(sql, variant);
        }
        return loadVariants({ productId: productId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("updateVariantSort()", err.message);
            return Promise.reject(err);
        }
        debug("updateVariantSort()", err);
        return Promise.reject(new Error('Error in updateVariantSort()'));
    }
}
async function deleteVariant(id) {
    try {
        const sql = `DELETE
                     FROM b2b_oscommerce.products_variants
                     WHERE id = :id`;
        const args = { id };
        await mysql2Pool.query(sql, args);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteVariant()", err.message);
            return Promise.reject(err);
        }
        debug("deleteVariant()", err);
        return Promise.reject(new Error('Error in deleteVariant()'));
    }
}
export async function getProduct(req, res) {
    try {
        const { id, keyword } = req.params;
        const product = await loadProduct({ id, keyword, complete: !!keyword });
        if (!product) {
            return res.status(404).json({ error: 'product not found' });
        }
        res.json({ products: [product] });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getProduct()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getProduct' });
    }
}
export async function postProduct(req, res) {
    try {
        const params = {
            ...req.body,
        };
        const product = await saveProduct(params);
        res.json({ product });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postProduct()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postProduct' });
    }
}
export async function getProductList(req, res) {
    try {
        const products = await loadList(req.params);
        res.json({ products });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadList()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in loadList' });
    }
}
export async function getVariantsList(req, res) {
    try {
        const { productId } = req.params;
        const variants = await loadVariants({ productId });
        res.json({ variants });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getVariantsList()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getVariantsList' });
    }
}
export async function getVariant(req, res) {
    try {
        const { productId, id } = req.params;
        const [variant = null] = await loadVariants({ productId, id });
        res.json({ variant });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getVariant()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getVariant' });
    }
}
export async function postVariant(req, res) {
    try {
        const variant = await saveVariant(req.body);
        res.json({ variant });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postVariant()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postVariant' });
    }
}
export async function delVariant(req, res) {
    try {
        const { productId, id } = req.params;
        await deleteVariant(id);
        const variants = await loadVariants({ productId });
        res.json({ variants });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delVariant()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in delVariant' });
    }
}
export async function postVariantSort(req, res) {
    try {
        const { productId } = req.params;
        const variants = await updateVariantSort(productId, req.body);
        res.json({ variants });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postItemSort()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postItemSort' });
    }
}
export async function postSetDefaultVariant(req, res) {
    try {
        const { productId, id } = req.params;
        const variants = await setDefaultVariant({ productId, variantId: id });
        res.json({ variants });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postSetDefaultVariant()", err.message);
            return Promise.reject(err);
        }
        debug("postSetDefaultVariant()", err);
        return Promise.reject(new Error('Error in postSetDefaultVariant()'));
    }
}
