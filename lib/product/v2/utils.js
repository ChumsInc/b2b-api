"use strict";
const debug = require('debug')('chums:lib:product:v2:utils');
const {mysql2Pool} = require('chums-local-modules');



const checkExistingKeyword = async ({id = 0, keyword, pagetype}) => {
    try {
        const query = `SELECT pagetype, keyword, id
                       FROM b2b_oscommerce.keywords
                       WHERE keyword = :keyword
                         AND NOT (pagetype = :pagetype AND id = :id)`;
        const data = {id: Number(id), keyword, pagetype};
        const [[row]] = await mysql2Pool.query(query, data);
        if (!!row && row.id !== id) {
            return Promise.reject(new Error(`Keyword ${keyword} already belongs to ${row.pagetype} ${row.id}`));
        }
    } catch (err) {
        debug("checkExistingKeyword()", err.message);
        return Promise.reject(err);
    }
};

exports.checkExistingKeyword = checkExistingKeyword;

const SELL_AS = {
    SELF: 1,
    MIX: 3,
    COLOR: 4
};

function checkSellAs(val, test) {
    return test === (val & test);
}

/**
 *
 * @param {string} productImage
 * @param {string} colorCode
 * @returns {*}
 */
function parseImageFilename(productImage, colorCode) {
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

exports.checkSellAs = checkSellAs;
exports.parseImageFilename = parseImageFilename;
exports.SELL_AS = SELL_AS;

/**
 *
 * @param {Object} fields - {paramField: 'mysqlField', ...}
 * @param {Object} params - {param: value, ...}
 * @return {{update: string, data: {id: *}}}
 */
exports.updateQueryFields = (fields, params) => {
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
