'use strict';

export const SELL_AS = {
    SELF: 1,
    MIX: 2,
    COLOR: 4
};

export function checkSellAs(val, test) {
    return test === val & test;
}

/**
 *
 * @param {string} productImage
 * @param {string} colorCode
 * @returns {*}
 */
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
export const updateQueryFields = (fields, params) => {
    const updateFields = [];
    const data = {id: params.id};
    Object.keys(fields)
        .map(f => {
            if (params[f]) {
                updateFields.push(`${fields[f]} = :${f}`);
                data[f] = params[f];
            }
        });
    const update = updateFields.join(', ');
    return {update, data};
};
