import {mysql2Pool} from "chums-local-modules";
import Debug from "debug";
import {Product} from "b2b-types";

const debug = Debug('chums:lib:product:where-used');

export interface WhereUsedProps {
    productId?: number;
    itemCode?: string;
}

export interface WhereUsedResponse {
    products?: Product[]
}
export async function loadWhereUsed({productId, itemCode}:WhereUsedProps):Promise<WhereUsedResponse> {
    try {
        const whereUsed:WhereUsedResponse = {};
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
    } catch(err:unknown) {
        if (err instanceof Error) {
            console.debug("loadWhereUsed()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadWhereUsed()", err);
        return Promise.reject(new Error('Error in loadWhereUsed()'));
    }
}
