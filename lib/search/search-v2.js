/**
 * Created by steve on 10/21/2016.
 */

const debug = require('debug')('chums:lib:search:v2');
const {mysql2Pool} = require('chums-local-modules');

function prepTerm(term) {
    return term.trim().replace(/[\s]+/g, ' ').substring(0, 255);
}

/**
 * Loads pages by searching for matching title or keyword, or for partial matches in text or meta description.
 * @param {string} site
 * @param {string} term
 * @param {Number} limit
 * @returns Promise
 */
async function loadPages({site, term, limit}) {
    try {
        const partterm = `[[:<:]]${term}`;
        const isBoolean = /(".+?"|\(.+?\)|[+\-<>~*])/.test(term);

        const search = term;
        const searchMode = isBoolean ? 'IN BOOLEAN MODE' : 'IN NATURAL LANGUAGE MODE';

        limit = Number(limit) || 20;

        const query = `SELECT DISTINCT
            'category'    AS result_type,
            cp.page_keyword,
            NULL          AS keyword,
            ci.item_image_url AS products_image,
            NULL          AS products_default_color,
            NULL          AS products_model,
            cp.page_title AS products_name
        FROM b2b_oscommerce.category_pages cp
            INNER JOIN b2b_oscommerce.category_pages_items ci ON ci.categorypage_id = cp.categorypage_id
            LEFT JOIN b2b_oscommerce.products_description p on p.products_id = ci.products_id
            LEFT JOIN b2b_oscommerce.category_pages ccp on ccp.categorypage_id = ci.categories_id
        WHERE cp.status = 1 and cp.page_keyword <> 'chums-products'
            AND (
                cp.page_title REGEXP :partterm
                OR cp.page_keyword REGEXP :partterm
                OR match(cp.page_title, cp.page_text, cp.page_description_meta) against(:search ${searchMode})
                OR match(ci.item_title, ci.item_text) against(:search ${searchMode})
                OR match(p.products_name) against(:search ${searchMode})
                OR match(ccp.page_title, ccp.page_text, ccp.page_description_meta) against(:search ${searchMode})
            )
            ORDER BY
                match(cp.page_title, cp.page_title, cp.page_description_meta) against(:search ${searchMode}) DESC,
                match(ci.item_title, ci.item_text) against(:search ${searchMode}) DESC,
                match(p.products_name) against(:search ${searchMode}) DESC,
                match(ccp.page_title, ccp.page_text, ccp.page_description_meta) against(:search ${searchMode}) DESC
        LIMIT :limit
      `;
        const data = {search, partterm, limit};
        const connection = await mysql2Pool.getConnection();
        const [rows, cols] = await connection.query(query, data);
        connection.release();
        return Promise.all(rows.map(page => loadPageImages({site, page})));
    } catch(err) {
        debug("loadPages()", err.message);
        return Promise.reject(err);
    }
}

async function loadPageImages({site, page}) {
    if (page.products_image) {
        return {...page, products_default_color: ''};
    }
    try {

        const query = `
                SELECT ifnull(pp.products_image, p.products_image) as products_image,
                    ifnull(pp.products_default_color, p.products_default_color) as products_default_color
                FROM b2b_oscommerce.category_pages cp
                INNER JOIN b2b_oscommerce.category_pages_items ci on ci.categorypage_id = cp.categorypage_id and cp.status = 1
                INNER JOIN b2b_oscommerce.products p on ci.products_id = p.products_id
                LEFT JOIN b2b_oscommerce.products pp on pp.products_id = p.default_parent_products_id
                WHERE cp.page_keyword = :keyword
                
                UNION
                
                SELECT ci.item_image_url as products_image, '' as products_default_color
                FROM b2b_oscommerce.category_pages cp
                INNER JOIN b2b_oscommerce.category_pages_items ci on ci.categorypage_id = cp.categorypage_id
                WHERE cp.page_keyword = :keyword and ifnull(ci.item_image_url, '') <> '' and cp.status = 1
                
                ORDER BY rand()
                LIMIT 1`;
        const data = {keyword: page.page_keyword};
        const connection = await mysql2Pool.getConnection();
        const [rows, cols] = await connection.query(query, data);
        connection.release();
        if (rows.length) {
            return {...page, ...rows[0]};
        }
        return page;
    } catch(err) {
        debug("loadPageImages()", err.message);
        return Promise.reject(err);
    }
}

/**
 * Loads search results for an item code
 * @param {string} site
 * @param {string} term
 * @returns {Promise.<*>}
 */
async function loadProduct({site, term}) {
    try {

        const query = `select 'product' as result_type, 
            (SELECT page_keyword 
                 FROM b2b_oscommerce.category_pages 
                 where categorypage_id = p.default_categories_id
             ) as page_keyword,
            ifnull(pp.products_keyword, p.products_keyword) as keyword,
            p.products_image,
            i.colorCode as products_default_color,
            i.itemCode as products_model,
            pd.products_name
            from  b2b_oscommerce.products_items i
            inner join b2b_oscommerce.products p on p.products_id = i.productsID
            INNER JOIN b2b_oscommerce.products_description pd on pd.products_id = p.products_id and pd.language_id = 1
            LEFT JOIN b2b_oscommerce.products pp on pp.products_id = p.default_parent_products_id
            where i.active = 1 and p.products_status = 1
                AND (itemCode = :term or p.products_upc REGEXP :upc)
            
            union 
            
            select 'product' as result_type, 
            (SELECT page_keyword 
                 FROM b2b_oscommerce.category_pages 
                 where categorypage_id = p.default_categories_id
             ) as page_keyword,
            ifnull(pp.products_keyword, p.products_keyword) as keyword,
            p.products_image,
            p.products_default_color,
            m.itemCode as products_model,
            pd.products_name
            from  b2b_oscommerce.products_mixes m
            inner join b2b_oscommerce.products p on p.products_id = m.productsID
            INNER JOIN b2b_oscommerce.products_description pd on pd.products_id = p.products_id and pd.language_id = 1
            LEFT JOIN b2b_oscommerce.products pp on pp.products_id = p.default_parent_products_id
            where m.active = 1 and p.products_status = 1
                AND (itemCode = :term OR p.products_upc REGEXP :upc)
                
            LIMIT 1`;
        const data = {term, upc: '^' + term.replace(/\s/g, '')};
        const connection = await mysql2Pool.getConnection();
        const [rows, cols] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch(err) {
        debug("loadProduct()", err.message);
        return Promise.reject(err);
    }
}

async function loadProducts({site, term, limit}) {
    const fullterm = `[[:<:]]${term}[[:>:]]`;
    const partterm = `[[:<:]]${term}`;
    const upc = `[[:<:]]${term.replace(/\s+/g, '')}`;
    const isBoolean = /(".+?"|\(.+?\)|[+\-<>~*])/.test(term);
    const search = term;
    const searchMode = isBoolean ? 'IN BOOLEAN MODE' : 'IN NATURAL LANGUAGE MODE';


    limit = Number(limit) || 20;

    const query = `SELECT DISTINCT
                'product' as result_type,
                (SELECT page_keyword 
                    FROM b2b_oscommerce.category_pages 
                    where categorypage_id = ifnull(pp.default_categories_id, p.default_categories_id)
                ) as page_keyword,
                ifnull(pp.products_keyword, p.products_keyword) as keyword,
                ifnull(pp.products_image, p.products_image) as products_image,
                ifnull(pp.products_default_color, p.products_default_color) as products_default_color,
                ifnull(pp.products_model, p.products_model) as products_model,
                ifnull(ppd.products_name, pd.products_name) as products_name
                FROM b2b_oscommerce.products p
                INNER JOIN b2b_oscommerce.products_description pd on pd.products_id = p.products_id and pd.language_id = 1
                LEFT JOIN b2b_oscommerce.products pp on pp.products_id = p.default_parent_products_id
                LEFT JOIN b2b_oscommerce.products_items i on i.productsID = p.products_id
                LEFT JOIN b2b_oscommerce.products_description ppd on ppd.products_id = pp.products_id and ppd.language_id = 1
                WHERE
                (
                    p.products_keyword regexp :partterm
                    or p.products_model regexp :partterm
                    or p.google_product_category regexp :partterm
                    or p.products_upc regexp :upc
                    or match(pd.products_name, pd.products_description) against (:search ${searchMode})            
                    or match(ppd.products_name, ppd.products_description) against (:search ${searchMode}) 
                    or match(pd.products_details) against (:search ${searchMode})
                    or match(ppd.products_details) against (:search ${searchMode})            

                    or i.itemCode regexp :partterm
                )
                and p.products_status = 1
                order by                     
                    match(pd.products_name, pd.products_description) against (:search ${searchMode}) DESC,          
                    match(ppd.products_name, ppd.products_description) against (:search ${searchMode}) DESC, 
                    match(pd.products_details) against (:search ${searchMode}) DESC,
                    match(ppd.products_details) against (:search ${searchMode}) DESC                      

                limit :limit`;
    const data = {fullterm, partterm, upc, search, limit};
    try {
        const connection = await mysql2Pool.getConnection();
        const [rows, cols] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch(err) {
        debug("loadProducts()", err.message, "\n" + query);
        return Promise.reject(err);
    }
}

function getPages(req, res, next) {
    const term = prepTerm(req.params.term);
    const site = res.locals.site || req.app.locals.site;
    loadPages({site, term, limit: req.params.limit})
        .then(result => {
            res.locals.result = result;
            next();
        })
        .catch(err => {
            res.jsonp({error: err});
        });
}

function getProduct(req, res, next) {
    const term = prepTerm(req.params.term);
    const site = res.locals.site || req.app.locals.site;
    loadProduct({site, term})
        .then(result => {
            result.map(r => {res.locals.result.push(r)});
            next();
        })
        .catch(err => {
            res.jsonp({error: err});
        });
}

function getProducts(req, res, next) {
    const term = prepTerm(req.params.term);
    const site = res.locals.site || req.app.locals.site;
    const limit = parseInt(req.params.limit, 10) - res.locals.result.length;
    loadProducts({site, term, limit})
        .then(result => {
            result.map(r => {res.locals.result.push(r)});
            next();
        })
        .catch(err => {
            res.jsonp({error: err});
        });
}

async function logResults({site, term, results}) {

    const query = `INSERT INTO b2b_oscommerce.search_history
        (search, results)
        VALUES (:search, :results)`;
    const data = {search: term, results: JSON.stringify(results)};
    try {
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return {};
    } catch(err) {
        debug("logResults()", err.message);
        return Promise.reject(err);
    }

}

function sendResult(req, res) {
    const term = prepTerm(req.params.term);
    const site = res.locals.site || req.app.locals.site;
    logResults({site, term, results: res.locals.result})
        .then(() => {
            res.jsonp({result: res.locals.result});
        })
        .catch(err => {
            res.jsonp({result: res.locals.result});
        });
}

exports.getPages = getPages;
exports.getProduct = getProduct;
exports.getProducts = getProducts;
exports.sendResult = sendResult;
