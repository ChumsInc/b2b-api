/**
 * Created by steve on 3/15/2016.
 */

const {mysql2Pool} = require('chums-local-modules');
const debug = require('debug')('chums:lib:product:v2:images');

/**
 *
 * @param {number|string?} id
 * @param {number|string?} productId
 * @param {Array?} productIdList
 * @returns {*}
 */
async function loadImages({id, productId, productIdList = []}) {
    try {
        if (productId) {
            productIdList.push(productId);
        }
        const query = `SELECT id, productID AS productId, image, ifnull(htmlContent, '') AS altText, priority, status, timestamp
                       FROM b2b_oscommerce.products_images
                       WHERE productID IN (:productIdList) OR id = :id
                       ORDER BY priority`;
        const data = {productIdList};
        const connection = await mysql2Pool.getConnection();
        const [images] = await connection.query(query, data);
        connection.release();
        return images;
    } catch (err) {
        debug("loadImages()", err.message);
        return Promise.reject(err);
    }
}


/**
 *
 * @param {Object} params
 * @param {number?} params.id
 * @param {number} params.productId
 * @param {string} params.image
 * @param {string} params.altText
 * @param {number} params.priority
 * @param {number} params.status
 */
async function saveImage({id, productId, image, altText, priority, status}) {
    let connection;
    try {
        if (Number(id || 0) === 0) {
            id = await addImage({productId, image});
        }
        const query = `UPDATE b2b_oscommerce.products_images
                       SET image       = :image,
                           htmlContent = :altText,
                           priority    = :priority,
                           status      = :status
                       WHERE id = :id`;
        const data = {id, image, altText, priority, status};
        connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadImages({productId});
    } catch (err) {
        debug("saveImage()", err.message);
        if (connection) {
            connection.release();
        }
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {number} params.productId
 * @param {string} params.image
 */
async function addImage({productId, image}) {
    let connection;
    try {
        const query = `INSERT INTO b2b_oscommerce.products_images (productID, image)
                       VALUES (:productId, :image)`;
        const data = {productId, image};
        connection = await mysql2Pool.getConnection();
        const [{insertId}] = await connection.query(query, data);
        connection.release();
        return insertId;
    } catch (err) {
        debug("addImage()", err.message);
        if (connection) {
            connection.release();
        }
        return err;
    }
}

/**
 *
 * @param {number|string} id
 * @param {number|string} productId
 */
async function deleteImage({id, productId}) {
    try {
        const query = `DELETE FROM b2b_oscommerce.products_images where id = :id and productID = :productId`;
        const data = {id, productId};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadImages({productId});
    } catch(err) {
        debug("deleteImage()", err.message);
        return Promise.reject(err);
    }
}

async function getImages(req, res) {
    try {
        const images = await loadImages(req.params);
        res.json({images});
    } catch(err) {
        debug("getImages()", err.message);
        res.json({error: err.message});
    }
}

async function getImage(req, res) {
    try {
        const params = {...req.params, ...req.query};
        const [image] = await loadImages(params);
        res.json({image: image || null});
    } catch(err) {
        debug("getImage()", err.message);
        res.json({error: err.message});
    }
}

async function postImage(req, res) {
    try {
        const images = await saveImage(req.body);
        res.json({images});
    } catch(err) {
        debug("postImage()", err.message);
        res.json({error: err.message});
    }
}

async function delImage(req, res) {
    try {
        const images = await deleteImage(req.params);
        res.json({images});
    } catch(err) {
        debug("delImage()", err.message);
        res.json({error: err.message});
    }
}

async function getImagesForProducts(req, res, next) {
    try {
        const products = res.locals.response.products || [];
        const productIdList = products.map(p => p.id);
        const images = await loadImages({productIdList});
        products.forEach(product => {
            product.images = images.filter(img => img.productId === product.id);
        });
        res.locals.products = products;
        next();
    } catch(err) {
        debug("getImagesForProducts()", err.message);
        res.json({error: err.message});
    }
}

exports.loadImages = loadImages;
exports.getImages = getImages;
exports.getImage = getImage;
exports.postImage = postImage;
exports.delImage = delImage;
exports.getImagesForProducts = getImagesForProducts;

