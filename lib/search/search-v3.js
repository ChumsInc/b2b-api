import Debug from "debug";
import {mysql2Pool} from "chums-local-modules";


import {parseImageFilename} from '../product/utils.js';
const debug = Debug('chums:lib:search:v3');

const HURRICANE = process.env.HURRICANE_IP;
const SLC = process.env.SLC_IP;

async function logResults({term, results}) {
    try {
        const query = `INSERT INTO b2b_oscommerce.search_history
                           (search, results)
                       VALUES (:search, :results)`;
        const data = {search: term, results: JSON.stringify(results)};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return {};
    } catch (err) {
        debug("logResults()", err.message);
        return Promise.reject(err);
    }

}

function prepTerm(term = '') {
    return term.trim().replace(/[\s]+/g, ' ').substring(0, 255);
}

const search3 = async ({term, limit, logResult = true}) => {
    term = prepTerm(term);
    const data = {search: term, re_search: `[[:<:]]${term.replace('+', ' ')}`};
    limit = Number(limit) || 20;
    if (limit > 100 || limit <= 0) {
        limit = 20;
    }
    const query = `
        SELECT DISTINCT keyword,
                        parent,
                        title,
                        sku,
                        pagetype,
                        image,
                        color,
                        additional_data,
                        max(score) AS score
        FROM (
                 /* search product */
                 SELECT p.products_keyword       AS keyword,
                        c.page_keyword           AS parent,
                        d.products_name          AS title,
                        p.products_model         AS sku,
                        'product'                AS pagetype,
                        p.products_image         AS image,
                        p.products_default_color AS color,
                        JSON_EXTRACT(ifnull(p.additional_data, '{}'), '$') as additional_data,
                        greatest(
                                match(products_name, products_description) against(:search IN NATURAL LANGUAGE MODE),
                                match(products_details) against(:search IN NATURAL LANGUAGE MODE),
                                if(d.products_name REGEXP :re_search, 1, 0) * (40 + (p.products_ordered / 10000))
                            )                    AS score
                 FROM b2b_oscommerce.products p
                      INNER JOIN b2b_oscommerce.products_description d ON d.products_id = p.products_id
                      LEFT JOIN b2b_oscommerce.category_pages c ON c.categorypage_id = p.default_categories_id                    
                 WHERE p.products_status = 1
                   AND redirect_to_parent <> 1
                   AND (
                         match(products_name, products_description) against(:search IN NATURAL LANGUAGE MODE)
                         OR match(products_details) against(:search IN NATURAL LANGUAGE MODE)
                         OR d.products_name REGEXP :re_search
                     )

                 UNION
                 SELECT keyword,
                        parent,
                        title,
                        sku,
                        'product'  AS pagetype,
                        image,
                        color,
                        JSON_EXTRACT(ifnull(additional_data, '{}'), '$') as additional_data,
                        max(score) AS score
                 FROM (
                          /* main product */
                          SELECT p.products_keyword                AS keyword,
                                 c.page_keyword                    AS parent,
                                 d.products_name                   AS title,
                                 p.products_model                  AS sku,
                                 p.products_image                  AS image,
                                 p.products_default_color          AS color,
                                 p.additional_data,
                                 50 + (p.products_ordered / 10000) AS score
                          FROM b2b_oscommerce.products p
                               INNER JOIN b2b_oscommerce.products_description d ON d.products_id = p.products_id
                               LEFT JOIN b2b_oscommerce.category_pages c ON c.categorypage_id = p.default_categories_id
                          WHERE p.products_status = 1
                            AND p.redirect_to_parent <> 1
                            AND (
                                  p.products_model REGEXP :re_search
                                  OR p.products_upc REGEXP replace(:re_search, ' ', '')
                              )

                              /* product variant */
                          UNION
                          SELECT p.products_keyword                 AS keyword,
                                 c.page_keyword                     AS parent,
                                 d.products_name                    AS title,
                                 p.products_model                   AS sku,
                                 p2.products_image                  AS image,
                                 p.products_default_color           AS color,
                                 JSON_EXTRACT(ifnull(p.additional_data, '{}'), '$') as additional_data,
                                 30 + (p2.products_ordered / 10000) AS score
                          FROM b2b_oscommerce.products p
                               INNER JOIN b2b_oscommerce.products_description d
                                          ON d.products_id = p.products_id
                               INNER JOIN b2b_oscommerce.products_variants v ON v.productID = p.products_id
                               INNER JOIN b2b_oscommerce.products p2 ON p2.products_id = v.variantProductID
                               LEFT JOIN b2b_oscommerce.category_pages c ON c.categorypage_id = p.default_categories_id
                          WHERE p.products_status = 1
                            AND p2.products_status = 1
                            AND p.redirect_to_parent <> 1
                            AND (
                                  p2.products_model REGEXP :re_search
                                  OR p2.products_upc REGEXP REPLACE(:re_search
                                  , ' '
                                  , '')
                              )

                              /* product item */
                          UNION
                          SELECT p.products_keyword                AS keyword,
                                 c.page_keyword                    AS parent,
                                 d.products_name                   AS title,
                                 p.products_model                  AS sku,
                                 p.products_image                  AS image,
                                 p.products_default_color          AS color,
                                 JSON_EXTRACT(ifnull(p.additional_data, '{}'), '$') as additional_data,
                                 25 + (p.products_ordered / 10000) AS score
                          FROM b2b_oscommerce.products p
                               INNER JOIN b2b_oscommerce.products_description d
                                          ON d.products_id = p.products_id
                               INNER JOIN b2b_oscommerce.products_items i ON i.productsID = p.products_id
                               LEFT JOIN b2b_oscommerce.category_pages c ON c.categorypage_id = p.default_categories_id
                          WHERE p.products_status = 1
                            AND p.redirect_to_parent <> 1
                            AND i.itemCode REGEXP :re_search
                            AND i.active = 1


                              /* product variant item */
                          UNION
                          SELECT p.products_keyword                 AS keyword,
                                 c.page_keyword                     AS parent,
                                 d.products_name                    AS title,
                                 p.products_model                   AS sku,
                                 p2.products_image                  AS image,
                                 i.colorCode                        AS color,
                                 JSON_EXTRACT(ifnull(p.additional_data, '{}'), '$') as additional_data,
                                 17 + (p2.products_ordered / 10000) AS score
                          FROM b2b_oscommerce.products p
                               INNER JOIN b2b_oscommerce.products_description d
                                          ON d.products_id = p.products_id
                               INNER JOIN b2b_oscommerce.products_variants v ON v.productID = p.products_id
                               INNER JOIN b2b_oscommerce.products p2 ON p2.products_id = v.variantProductID
                               INNER JOIN b2b_oscommerce.products_items i ON i.productsID = p2.products_id
                               LEFT JOIN b2b_oscommerce.category_pages c ON c.categorypage_id = p.default_categories_id
                          WHERE p.products_status = 1
                            AND p.redirect_to_parent <> 1
                            AND i.itemCode REGEXP :re_search
                            AND i.active = 1

                              /* parent product item */
                          UNION
                          SELECT p.products_keyword AS keyword,
                                 c.page_keyword     AS parent,
                                 d.products_name    AS title,
                                 p.products_model   AS sku,
                                 p2.products_image  AS image,
                                 i.colorCode        AS color,
                                 JSON_EXTRACT(ifnull(p.additional_data, '{}'), '$') as additional_data,
                                 15                 AS score
                          FROM b2b_oscommerce.products p
                               INNER JOIN b2b_oscommerce.products_description d
                                          ON d.products_id = p.products_id
                               INNER JOIN b2b_oscommerce.products p2
                                          ON p2.default_parent_products_id = p.products_id AND p2.redirect_to_parent = 1
                               INNER JOIN b2b_oscommerce.products_items i ON i.productsID = p2.products_id
                               LEFT JOIN b2b_oscommerce.category_pages c ON c.categorypage_id = p.default_categories_id
                          WHERE p.products_status = 1
                            AND p.redirect_to_parent <> 1
                            AND i.itemCode REGEXP :re_search
                            AND i.active = 1
                      ) p
                 GROUP BY keyword

                 UNION
                 SELECT keyword,
                        NULL   AS parent,
                        title,
                        ''     AS sku,
                        'page' AS pagetype,
                        ''     AS image,
                        ''     AS color,
                        JSON_EXTRACT('{}', '$')   AS additional_data,
                        greatest(
                                match(title, meta_description) against(:search IN NATURAL LANGUAGE MODE),
                                match(content) against(:search IN NATURAL LANGUAGE MODE),
                                match(search_words) against(:search IN NATURAL LANGUAGE MODE)
                            )  AS score
                 FROM b2b_oscommerce.pages
                 WHERE status = 1
                   AND (match(title, meta_description) against(:search IN NATURAL LANGUAGE MODE)
                     OR match(content) against(:search IN NATURAL LANGUAGE MODE)
                     OR match(search_words) against(:search IN NATURAL LANGUAGE MODE)
                     )

                 UNION
                 SELECT page_keyword AS keyword,
                        NULL         AS parent,
                        page_title   AS title,
                        ''           AS sku,
                        'category'   AS pagetype,
                        ''           AS image,
                        ''           AS color,
                        JSON_EXTRACT(ifnull(more_data, '{}'), '$')    AS additional_data,
                        greatest(
                                match(page_text) against(:search IN NATURAL LANGUAGE MODE),
                                match(page_title, page_text, page_description_meta)
                                      against(:search IN NATURAL LANGUAGE MODE)
                            )        AS score
                 FROM b2b_oscommerce.category_pages
                 WHERE status = 1
                 HAVING score > 0

                 UNION
                 /* search category page items */
                 SELECT p.page_keyword AS keyword,
                        NULL           AS parent,
                        page_title     AS title,
                        ''             AS sku,
                        'category'     AS pagetype,
                        ''             AS image,
                        ''             AS color,
                        JSON_EXTRACT(ifnull(more_data, '{}'), '$')    AS additional_data,
                        greatest(
                                match(item_title, item_text) against(:search IN NATURAL LANGUAGE MODE),
                                match(section_title, section_description) against(:search IN NATURAL LANGUAGE MODE)
                            )          AS score
                 FROM b2b_oscommerce.category_pages p
                      INNER JOIN b2b_oscommerce.category_pages_items i ON i.categorypage_id = p.categorypage_id
                 WHERE p.status = 1
                   AND i.status = 1
                 HAVING score > 0
             ) results
        GROUP BY keyword, parent, title, sku, pagetype, image, color, additional_data
        ORDER BY score DESC, keyword
        LIMIT ${limit}`;
    try {

        const [rows] = await mysql2Pool.query(query, data);
        rows.map(row => {
            if (row.image) {
                row.image = parseImageFilename(row.image, row.color || '');
            }
            row.additional_data = JSON.parse(row.additional_data || '{}');
        });

        if (logResult) {
            await logResults({term, results: rows});
        }
        // debug(`'Search: ${term}: ${rows.length}`);
        return rows;
    } catch (err) {
        debug('search()', err.message);
        return Promise.reject(err);
    }

};

export const getSearch3 = async (req, res) => {
    try {
        const params = req.params;
        params.logResult = !(req.ip === HURRICANE || req.ip === SLC);
        const result = await search3(params);
        res.json({result});
    } catch(err) {
        if (err instanceof Error) {
            debug("getSearch3()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getSearch3'});
    }
}

export const getSearch3b = async (req, res) => {
    try {
        const params = {
            term: req.query.term,
            limit: req.query.limit ?? 50,
            logResult: !(req.ip === HURRICANE || req.ip === SLC)
        }
        const result = await search3(params);
        res.json(result);
    } catch(err) {
        if (err instanceof Error) {
            debug("getSearch3b()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getSearch3b'});
    }
}

