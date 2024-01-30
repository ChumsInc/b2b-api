const debug = require('debug')('chums:lib:product:specials');
const {mysql2Pool} = require('chums-local-modules');
const dayjs = require("dayjs");

const load = async ({id = null, productId = null}) => {
    try {
        const query = `SELECT specials_id                 AS id,
                              p.products_id,
                              specials_new_products_price AS salePrice,
                              expires_date                AS expires,
                              starts_date                 AS starts,
                              status,
                              products_model,
                              products_keyword,
                              minPrice,
                              maxPrice
                       FROM b2b_oscommerce.specials s
                            INNER JOIN b2b_oscommerce.products p ON p.products_id = s.products_id
                            LEFT JOIN (SELECT pi.productsId,
                                              min(SuggestedRetailPrice * SalesUMConvFctr) AS minPrice,
                                              max(suggestedRetailPrice * SalesUMConvFctr) AS maxPrice
                                       FROM b2b_oscommerce.products_to_itemcodes pi
                                            LEFT JOIN c2.ci_item i ON i.company = pi.company AND i.ItemCode = pi.ItemCode
                                       WHERE NOT (i.ProductType = 'D' OR i.InactiveItem = 'Y')
                                       GROUP BY pi.productsID) AS price ON price.productsID = p.products_id
                       WHERE (specials_id = :id OR :id IS NULL)
                            AND (p.products_id = :productId OR :productId IS NULL)`;
        const data = {id, productId};
        const connection = await mysql2Pool.getConnection();
        const [result] = await connection.query(query, data);
        connection.release();
        return result;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
};

const saveNew = async ({productId, salePrice, expires, starts}) => {
    try {
        expires = !expires || !dayjs(expires).isValid() ? null :  dayjs(expires).format('YYYY-MM-DD 23:59:59');
        starts = !starts || !dayjs(starts).isValid() ? null : dayjs(starts).format('YYYY-MM-DD 00:00:00');

        const query = `INSERT INTO b2b_oscommerce.specials 
            (products_id, specials_new_products_price, expires_date, starts_date, status) 
            VALUES (:productId, :salePrice, :expires, :starts, 1)`;
        const data = {productId, salePrice, expires, starts};
        const connection = await mysql2Pool.getConnection();
        const [result] = await connection.query(query, data);
        debug('saveNew()', {data, result});
        connection.release();
        return await load({id: result.insertId});
    } catch (err) {
        debug("saveNew()", err.message);
        return Promise.reject(err);
    }
};

const save = async ({id, productId, salePrice, expires, starts}) => {
    try {
        debug('save()', {id, productId, salePrice, expires, starts});
        if (!id || id === '0') {
            return saveNew({productId, salePrice, expires, starts});
        }
        expires = !expires || !dayjs(expires).isValid() ? null :  dayjs(expires).format('YYYY-MM-DD 23:59:59');
        starts = !starts || !dayjs(starts).isValid() ? null : dayjs(starts).format('YYYY-MM-DD 00:00:00');

        const query = `UPDATE b2b_oscommerce.specials 
                       SET specials_new_products_price = :salePrice, 
                           expires_date = :expires, 
                           starts_date = :starts, 
                           status = 1
                       WHERE specials_id = :id`;
        const data = {id, salePrice, expires, starts};
        const connection = await mysql2Pool.getConnection();
        const [result] = await connection.query(query, data);
        debug('save()', {data, result});
        connection.release();
        return await load({id});
    } catch (err) {
        debug("saveNew()", err.message);
        return Promise.reject(err);
    }
};

const deleteSpecial = async ({id}) => {
    try {
        const query = `DELETE FROM b2b_oscommerce.specials WHERE specials_id = :id`;
        const data = {id};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return {success: true};
    } catch (err) {
        debug("deleteSpecial()", err.message);
        return Promise.reject(err);
    }

};

exports.get = async (req, res) => {
    try {
        const specials = await load(req.params);
        res.json({specials});
    } catch (err) {
        debug("get()", err.message);
        res.json({error: err.message});
    }
};

exports.post = async (req, res) => {
    try {
        const [special] = await save(req.body);
        res.json({special});
    } catch (err) {
        debug("post()", err.message);
        res.json({error: err.message});
    }
};

exports.delete = async (req, res) => {
    try {
        const result = await deleteSpecial(req.params);
        res.json({result});
    } catch (err) {
        debug("delete()", err.message);
        return Promise.reject(err);
    }
};
