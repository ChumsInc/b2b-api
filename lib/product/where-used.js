import Debug from "debug";
const debug = Debug('chums:lib:product:where-used');
export async function loadWhereUsed({ productId, itemCode }) {
    try {
        const whereUsed = {};
        const sqlProductsAsVariant = `SELECT p.products_id, p.products_keyword
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
        `;
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
