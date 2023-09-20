import Debug from "debug";
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:product:where-used');
export async function loadWhereUsed(productId, itemCode) {
    try {
        const whereUsed = {};
        const sqlProductsAsVariant = `SELECT p.products_id AS id, p.products_keyword AS keyword
                                      FROM b2b_oscommerce.products p
                                               INNER JOIN b2b_oscommerce.products_variants pv ON pv.productID = p.products_id
                                      WHERE pv.variantProductID = :productId`;
        const sqlProductItemCode = `SELECT p.products_id, p.products_keyword
                                    FROM b2b_oscommerce.products p
                                    WHERE p.products_model = :itemCode
                                    UNION
                                    SELECT p2.products_id, p.products_keyword
                                    FROM b2b_oscommerce.products p
                                             INNER JOIN b2b_oscommerce.products_variants pv ON pv.productID = p.products_id
                                             INNER JOIN b2b_oscommerce.products p2 ON p2.products_id = pv.variantProductID
                                    WHERE p2.products_model = :itemCode
                                    UNION
                                    SELECT p.products_id, p.products_keyword
                                    FROM b2b_oscommerce.products p
                                             INNER JOIN b2b_oscommerce.products_items pi ON pi.productsID = p.products_id
                                    WHERE pi.itemCode = :itemCode
                                    UNION
                                    SELECT p.products_id AS id, p.products_keyword AS keyword
                                    FROM b2b_oscommerce.products_mixes_detail pmd
                                             INNER JOIN b2b_oscommerce.products_mixes pm ON pm.mixID = pmd.mixID
                                             INNER JOIN b2b_oscommerce.products p ON p.products_id = pm.productsID
                                    WHERE pmd.itemCode = :itemCode`;
        const sqlProductInCategory = `SELECT cp.categorypage_id, cp.page_keyword
                                      FROM b2b_oscommerce.category_pages cp
                                               INNER JOIN b2b_oscommerce.category_pages_items cpi
                                                          ON cpi.categorypage_id = cp.categorypage_id
                                      WHERE cpi.products_id IN (:productIds)`;
        const [vRows] = await mysql2Pool.query(sqlProductsAsVariant, { productId, itemCode });
        const [iRows] = await mysql2Pool.query(sqlProductItemCode, { productId, itemCode });
        whereUsed.products = [...vRows, ...iRows];
        const [cpRows] = await mysql2Pool.query(sqlProductInCategory, { productIds: whereUsed.products.map(p => p.id) });
        whereUsed.categoryPages = [...cpRows];
        return whereUsed;
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("loadWhereUsed()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadWhereUsed()", err);
        return Promise.reject(new Error('Error in loadWhereUsed()'));
    }
}
export const getWhereUsed = async (req, res) => {
    try {
        const productId = String(req.query.id ?? '');
        const itemCode = String(req.query.itemCode ?? '');
        const whereUsed = await loadWhereUsed(productId, itemCode);
        res.json({ whereUsed });
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("getWhereUsed()", err.message);
            return Promise.reject(err);
        }
        console.debug("getWhereUsed()", err);
        return Promise.reject(new Error('Error in getWhereUsed()'));
    }
};
