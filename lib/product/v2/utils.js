import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:product:v2:utils');
export const SELL_AS_SELF = 1;
export const SELL_AS_VARIANTS = 0;
export const SELL_AS_MIX = 3;
export const SELL_AS_COLORS = 4;
export const checkExistingKeyword = async ({ id = 0, keyword, pagetype }) => {
    try {
        const query = `SELECT pagetype, keyword, id
                       FROM b2b_oscommerce.keywords
                       WHERE keyword = :keyword
                         AND NOT (pagetype = :pagetype AND id = :id)`;
        const data = { id: Number(id), keyword, pagetype };
        const [[row]] = await mysql2Pool.query(query, data);
        if (!!row && row.id !== id) {
            return Promise.reject(new Error(`Keyword ${keyword} already belongs to ${row.pagetype} ${row.id}`));
        }
    }
    catch (err) {
        if (err instanceof Error) {
            debug("checkExistingKeyword()", err.message);
            return Promise.reject(err);
        }
        debug("checkExistingKeyword()", err);
        return Promise.reject(new Error('Error in checkExistingKeyword()'));
    }
};
export const SELL_AS = {
    SELF: 1,
    MIX: 3,
    COLOR: 4
};
export function checkSellAs(val, test) {
    return test === (val & test);
}
export function parseImageFilename(productImage, colorCode) {
    if (productImage === null) {
        return '';
    }
    if (colorCode === null) {
        colorCode = '';
    }
    if (typeof colorCode === 'number') {
        colorCode = String(colorCode);
    }
    productImage = productImage.replace(/\?/, colorCode);
    colorCode.split('').map(code => {
        productImage = productImage.replace(/\*/, code);
    });
    productImage = productImage.replace(/\*/g, '');
    return productImage;
}
/**
 *
 * @param {Object} fields - {paramField: 'mysqlField', ...}
 * @param {Object} params - {param: value, ...}
 * @return {{update: string, data: {id: *}}}
 */
// export const updateQueryFields = (fields, params) => {
//     const updateFields = [];
//     const data = {id: params.id};
//     Object.keys(fields)
//         .map(f => {
//             if (params[f]) {
//                 updateFields.push(`${fields[f]} = :${f}`);
//                 data[f] = params[f];
//             }
//         });
//     const update = updateFields.join(', ');
//     return {update, data};
// };
export const isCartItem = (item) => {
    if (!item) {
        return false;
    }
    return item.itemCode !== undefined;
};
export const isCartProduct = (item) => {
    if (!item) {
        return false;
    }
    return isCartItem(item) && item.productId !== undefined;
};
export const isProduct = (product) => {
    if (!product) {
        return false;
    }
    return product.id !== undefined;
};
export function isCategoryChildSection(child) {
    return child.itemType === 'section';
}
export function isCategoryChildCategory(child) {
    return child.itemType === 'category';
}
export function isCategoryChildProduct(child) {
    return child.itemType === 'product';
}
export function isCategoryChildLink(child) {
    return child.itemType === 'link';
}
export function isSellAsSelf(product) {
    return !!product && product.sellAs === SELL_AS_SELF;
}
export function isSellAsVariants(product) {
    return !!product && product.sellAs === SELL_AS_VARIANTS;
}
export function isSellAsMix(product) {
    return !!product && product.sellAs === SELL_AS_MIX;
}
export function isSellAsColors(product) {
    return !!product && product.sellAs === SELL_AS_COLORS;
}
