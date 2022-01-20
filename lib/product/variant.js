'use strict';

const debug = require('debug')('chums:lib:product:variant');
const {mysql2Pool} = require('chums-local-modules');
const router = require('express').Router();
const _product = require('./product');

/**
 * @typedef {object} Variant
 * @property {number} id
 * @property {number} parentProductID
 * @property {number} variantProductID
 * @property {string} title
 * @property {number|boolean} isDefaultVariant
 * @property {number|boolean} status
 * @property {number} priority
 * @property {string|number} timestamp
 */

/**
 *
 * @param {number|string} [id]
 * @param {number|string} [productID]
 * @returns {Promise<Variant[]>}
 */
async function load({id, productID}) {
    try {
        const sql = `SELECT id,
                            productID AS parentProductID,
                            variantProductID,
                            title,
                            isDefaultVariant,
                            active    AS status,
                            priority,
                            timestamp
                     FROM b2b_oscommerce.products_variants
                     WHERE (ISNULL(:id) OR id = :id)
                     AND (ISNULL(:productID) OR productID = :productID)`;
        const data = {id, productID};
        const [rows] = await mysql2Pool.query(sql, data);
        return rows;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
}

/**
 * This will set the default variant for a product, and clear the flag from other variants of that product.
 * @param {object} params
 * @param {number} params.productId
 * @param {number} params.variantId
 */
async function setDefaultVariant(params) {
    try {
        const {productId, variantId} = params;
        if (!productId || !variantId) {
            return Promise.reject(new Error('Must have a valid productID and variantId'));
        }
        const sql = `CALL b2b_oscommerce.set_default_variant(:productId, :variantId)`;
        await mysql2Pool.query(sql, {productId, variantId});
    } catch (err) {
        debug("setDefaultVariant()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Variant} variant
 */
async function saveNew({variant}) {
    try {
        if (!variant) {
            return Promise.reject(new Error('variant.js::save() missing parameters'));
        }
        const {parentProductID, variantProductID, title, status, priority} = variant;
        const sql = `INSERT INTO b2b_oscommerce.products_variants (productID, variantProductID, title, active, priority)
                     VALUES (:parentProductID, :variantProductID, :title, :active, :priority)`;
        const args = {parentProductID, variantProductID, title, active: status, priority};
        await mysql2Pool.query(sql, args);
        return variant.id;
    } catch (err) {
        debug("saveNew()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {object} params
 * @param {Variant} params.variant
 */
async function save({variant}) {
    try {
        if (!variant) {
            return Promise.reject(new Error('variant.js::save() missing parameters'));
        }

        if (!variant.id) {
            return saveNew({variant});
        }
        const {id, status, priority, title} = variant;
        const sql = `UPDATE b2b_oscommerce.products_variants
                     SET title    = :title,
                         active   = :active,
                         priority = :priority
                     WHERE id = :id`;
        const args = {id, title, active: status, priority};
        await mysql2Pool.query(sql, args);
        return variant.id;
    } catch (err) {
        debug("save()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {object} params
 * @param {number|string} params.id
 */
async function deleteVariant({id}) {
    try {
        const sql = `DELETE FROM b2b_oscommerce.products_variants where id = :id`;
        const args = {id};
        const [{rowsAffected}] = await mysql2Pool.query(sql, args);
        return rowsAffected;
    } catch(err) {
        debug("deleteVariant()", err.message);
        return Promise.reject(err);
    }
}

async function getProductVariants(req, res, next) {
    try {
        let products = [];
        if (res.locals.response !== undefined && res.locals.response.products !== undefined) {
            // get the products from the previous method
            products = res.locals.response.products || [];
        }
        for await (const product of products) {
            const [variant] = await load({productID: product.id});
            if (variant) {
                product.variant = variant;
                const [variantProduct] = await _product.load({id: variant.variantProductID})
                product.variant.product = variantProduct;
            }
        }
        if (!res.locals.response) {
            res.locals.response = {};
        }
        res.locals.response.products = products;
        next();
    } catch(err) {
        debug("getProductVariants()", err.message);
        return res.json({error: err.message});
    }
    /*
    var products = [];
    var site = res.locals.site || req.app.locals.site;
    if (res.locals.response !== undefined && res.locals.response.products !== undefined) {
        // get the products from the previous method
        products = res.locals.response.products || [];
    }

    if (products.length === 0 && req.params.id !== undefined) {
        // there are no products in the previous response (maybe there wasn't one?), so get the products for the requested id
        products = [{id: req.params.id}];
    }

    async.forEachOfLimit(products, 4, function (value, key, callback) {
        load({
            site: site,
            id: value.id
        }, function (err, variants) {
            if (err) {
                return callback(err);
            }
            async.forEachOfSeries(variants, function (value, key, callback) {
                const params = {
                    site: site,
                    id: value.variantProductID
                };
                product.load(params)
                    .then(vProduct => {
                        variants[key].product = vProduct.length ? vProduct[0] : {};
                        callback();
                    })
                    .catch(err => {
                        debug('getProductVariants()', err);
                        callback(err);
                    });
            }, function (err) {
                if (err) {
                    debug('[variant.js::get > variants > products] Error returned');
                    debug(err);
                }
                products[key].variants = variants;
                callback();
            });
        });
    }, function (err) {
        if (err) {
            debug('[variant.js::load] Error returned');
            debug(err);
        }
        if (res.locals.response === undefined) {
            res.locals.response = {};
        }
        res.locals.response.products = products;
        next();
    });

     */
}

async function getProduct(req, res) {
    try {
        const variants = await load(req.params);
        res.json({variants});
    } catch(err) {
        debug("getProduct()", err.message);
        res.json({error: err.message});
    }
}

async function getVariant(req, res) {
    try {
        const variants = await load(req.params);
        res.json({variants});
    } catch(err) {
        debug("getVariant()", err.message);
        res.json({error: err.message})
    }
}

async function post(req, res, next) {
    try {
        res.locals.variantId = await save(req.body);
        return next();
    } catch(err) {
        debug("post()", err.message);
        res.locals.error = err.message;
        return next(err.message);
    }
}

async function postDefaultVariant(req, res, next) {
    try {
        const params = {
            productId: req.params.productID,
            variantId: req.params.variantID,
        };
        await setDefaultVariant(params);
        return next();
    } catch(err) {
        debug("postDefaultVariant()", err.message);
        res.locals.error = err.message;
        return next(err.message);
    }
}

async function del(req, res) {
    try {
        const result = await deleteVariant(req.params);
        res.json({success: true, result});
    } catch(err) {
        debug("del()", err.message);
        res.json({error: err.message});
    }
}

router.delete('/:id', del);
router.post('/', post);

router.get('/:id(\\d+)$', getVariant);

router.get('/product/:productID(\\d+)$', getProduct);


exports.get = getProductVariants;
exports.del = del;
exports.post = post;
exports.postDefaultVariant = postDefaultVariant;
exports.setDefaultVariant = setDefaultVariant;
exports.getProduct = getProduct;
exports.getProductVariants = getProductVariants;
exports.router = router;
