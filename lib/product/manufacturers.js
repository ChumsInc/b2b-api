'use strict';
import Debug from 'debug';

const  debug = Debug('chums:lib:product:manufacturers');
import {mysql2Pool} from 'chums-local-modules';

const companies = {
    '11': 'bc',
    '12': 'chums',
};

const companyKeys = {
    chums: '12',
    safety: '12',
    bc: '11',
    beyondcoastal: '11',
    'beyond coastal': '11',
    '11': '11',
    '12': '12'
};

/**
 * returns a company value for c2 queries ('chums'|'bc')
 * @param  {number|string} manufacturersId [description]
 * @return {string}                 ('chums'|'bc')
 */
export function company(manufacturersId= companyKeys.chums) {
    let index = manufacturersId;
    if (typeof manufacturersId === 'string') {
        index = companyKeys[manufacturersId.toLowerCase()];
    }
    return companies[index] ?? companies[companyKeys.chums];

}

async function loadManufacturers({id} = {}) {
    try {
        const query = `SELECT manufacturers_id AS id, manufacturers_name AS name, company
                       FROM b2b_oscommerce.manufacturers
                       WHERE (ISNULL(:id) || manufacturers_id = :id)`;
        const [rows] = await mysql2Pool.query(query, {id});
        return rows;
    } catch (err) {
        debug("loadManufacturers()", err.message);
        return Promise.reject(err);
    }
}

export async function getManufacturers(req, res) {
    try {
        const manufacturers = await loadManufacturers(req.params);
        res.json({manufacturers});
    } catch (err) {
        debug("get()", err.message);
        res.json({error:err.message, name: err.name});
    }
}
