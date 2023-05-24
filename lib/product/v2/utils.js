import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:product:v2:utils');
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
