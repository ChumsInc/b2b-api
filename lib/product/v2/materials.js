/**
 * Created by Steve Montgomery on 3/14/2016.
 */

const debug = require('debug')('chums:lib:product:materials');
const {mysql2Pool} = require('chums-local-modules');

const loadMaterials = async ({site, id = null}) => {
    try {
        const query = `SELECT materials_id    AS id,
                              materials_name  AS name,
                              swatch_path     AS path,
                              swatch_filetype AS filetype,
                              materials_group AS materialsGroup,
                              active
                       FROM b2b_oscommerce.materials
                       WHERE materials_id = :id
                          OR :id IS NULL
                       ORDER BY materials_name, materials_id`;
        const data = {id};
        const [rows] = await mysql2Pool.query(query, data);
        if (id && rows[0]) {
            rows[0].products = await loadMaterialProducts({site, id});
        }
        return rows;
    } catch (err) {
        debug("loadMaterials()", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {Object} params
 * @param {string} params.site
 * @param {int} params.id
 * @param {string} params.name
 * @param {string} params.path
 * @param {string} params.filetype
 * @param {string} params.materialsGroup
 */
const saveMaterial = async ({site, id, name, path, filetype, materialsGroup, active}) => {
    try {
        if (!id) {
            return await saveNewMaterial({site, name, path, filetype, materialsGroup});
        }
        const query = `UPDATE b2b_oscommerce.materials
                       SET materials_name  = :name,
                           swatch_path     = :path,
                           swatch_filetype = :filetype,
                           materials_group = :materialsGroup,
                           active          = :active
                       WHERE materials_id = :id`;
        const data = {name, path, filetype, materialsGroup, id, active: !!active ? 1 : 0};
        await mysql2Pool.query(query, data);
        return await loadMaterials({site, id});
    } catch (err) {
        debug("saveMaterial()", err.message);
        return Promise.reject(err);
    }
};

const saveNewMaterial = async ({site, name, path, filetype, materialsGroup}) => {
    try {
        const query = `INSERT INTO b2b_oscommerce.materials (materials_name, swatch_path, swatch_filetype, materials_group, active)
                       VALUES (:name, :path, :filetype, :materialsGroup, 1)`;
        const data = {name, path, filetype, materialsGroup};
        const [{insertId}] = await mysql2Pool.query(query, data);
        return await loadMaterials({site, id: insertId});
    } catch (err) {
        debug("saveNewMaterial()", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {string} site
 * @param {number} id
 */
const loadMaterialProducts = async ({site, id}) => {
    try {
        const query = `SELECT p.products_id AS id, p.products_keyword AS keyword, d.products_name AS name,
                p.products_model AS itemCode, p.products_status AS status, p.products_default_color AS defaultColor,
                p.products_sell_as AS sellAs
            FROM b2b_oscommerce.products p
                INNER JOIN b2b_oscommerce.products_description d ON d.products_id = p.products_id AND d.language_id = 1
                INNER JOIN b2b_oscommerce.materials m ON m.materials_id = p.materials_id
            WHERE m.materials_id = :id`;
        const data = {id};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch(err) {
        debug("loadMaterialProducts()", err.message);
        return Promise.reject(err);
    }
};

const getMaterials = (req, res) => {
    const {site} = res.locals;
    const {id = null} = req.params;
    loadMaterials({site, id})
        .then(materials => {
            res.json({materials});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};

function postMaterial(req, res) {
    const params = {
        site: res.locals.site,
        ...req.body,
    };
    saveMaterial(params)
        .then(materials => {
            res.json({materials});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        })
}

const getMaterialProducts = (req, res) => {
    const params = {
        site: res.locals.site,
        id: req.params.id
    };
    loadMaterialProducts(params)
        .then(products => {
            res.json({products});
        })
        .catch(err => {
            res.status(500).json({error: err.message});
        });
};



exports.loadMaterials = loadMaterials;
exports.saveMaterial = saveMaterial;
exports.getMaterials = getMaterials;
exports.postMaterial = postMaterial;
exports.getMaterialProducts = getMaterialProducts;

