import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:product:v2:images');
export async function loadImages({ id, productId, productIdList = [] }) {
    try {
        if (productId) {
            productIdList.push(productId);
        }
        const query = `SELECT id,
                              productID               AS productId,
                              image,
                              IFNULL(htmlContent, '') AS altText,
                              priority,
                              status,
                              timestamp
                       FROM b2b_oscommerce.products_images
                       WHERE productID IN (:productIdList)
                          OR id = :id
                       ORDER BY priority`;
        const data = { id, productIdList };
        const [images] = await mysql2Pool.query(query, data);
        return images;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadImages()", err.message);
            return Promise.reject(err);
        }
        debug("loadImages()", err);
        return Promise.reject(new Error('Error in loadImages()'));
    }
}
async function saveImage({ id, productId, image, altText, priority, status }) {
    try {
        if (Number(id || 0) === 0) {
            id = await addImage({ productId, image });
        }
        const query = `UPDATE b2b_oscommerce.products_images
                       SET image       = :image,
                           htmlContent = :altText,
                           priority    = :priority,
                           status      = :status
                       WHERE id = :id`;
        const data = { id, image, altText, priority, status };
        await mysql2Pool.query(query, data);
        return await loadImages({ productId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveImage()", err.message);
            return Promise.reject(err);
        }
        debug("saveImage()", err);
        return Promise.reject(new Error('Error in saveImage()'));
    }
}
async function addImage({ productId, image }) {
    try {
        const query = `INSERT INTO b2b_oscommerce.products_images (productID, image)
                       VALUES (:productId, :image)`;
        const data = { productId, image };
        const [{ insertId }] = await mysql2Pool.query(query, data);
        return insertId;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("addImage()", err.message);
            return Promise.reject(err);
        }
        debug("addImage()", err);
        return Promise.reject(new Error('Error in addImage()'));
    }
}
async function deleteImage({ id, productId }) {
    try {
        const query = `DELETE FROM b2b_oscommerce.products_images WHERE id = :id AND productID = :productId`;
        const data = { id, productId };
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadImages({ productId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteImage()", err.message);
            return Promise.reject(err);
        }
        debug("deleteImage()", err);
        return Promise.reject(new Error('Error in deleteImage()'));
    }
}
export async function getImages(req, res) {
    try {
        const images = await loadImages(req.params);
        res.json({ images });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getImages()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getImages' });
    }
}
export async function getImage(req, res) {
    try {
        const params = { ...req.params, ...req.query };
        const [image] = await loadImages(params);
        res.json({ image: image || null });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getImage()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getImage' });
    }
}
export async function postImage(req, res) {
    try {
        const images = await saveImage(req.body);
        res.json({ images });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postImage()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in postImage' });
    }
}
export async function delImage(req, res) {
    try {
        const { id, productId } = req.params;
        const images = await deleteImage({ id, productId });
        res.json({ images });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delImage()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in delImage' });
    }
}
export async function getImagesForProducts(req, res, next) {
    try {
        const products = res.locals.response.products || [];
        const productIdList = products.map(p => p.id);
        const images = await loadImages({ productIdList });
        products.forEach(product => {
            product.images = images.filter(img => img.productId === product.id);
        });
        res.locals.products = products;
        next();
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getImagesForProducts()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getImagesForProducts' });
    }
}
