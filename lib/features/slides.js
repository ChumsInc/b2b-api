const debug = require('debug')('chums:lib:features:slides');
const {mysql2Pool} = require('chums-local-modules');

/**
 *
 * @param {Boolean} [all]
 * @param {Number} [id]
 * @return {Promise<*|Promise<*|*|*|Promise<never>|undefined>|*|{}>}
 */
async function loadSlides({all = false, id}) {
    try {
        const query = `SELECT id,
                              name,
                              title,
                              mainImage,
                              startDate,
                              endDate,
                              css AS cssClass,
                              actionURL,
                              status,
                              priority,
                              target,
                              responsive,
                              sizes,
                              mainOverlay
                       FROM b2b_oscommerce.slides
                       WHERE (:id IS NOT NULL AND id = :id)
                          OR (:id IS NULL
                           AND :all = 0
                           AND (
                                      DATE(IFNULL(startDate, NOW())) <= DATE(NOW())
                                      AND DATE(IFNULL(endDate, NOW())) >= DATE(NOW())
                                      AND status = 1
                                  )
                           )
                          OR (:all = 1)
                          ORDER BY priority`;
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, {id, all: all ? 1 : 0});
        connection.release();
        rows.map(row => {
            row.status = row.status === 1;
            row.responsive = row.responsive === 1;
            row.sizes = JSON.parse(row.sizes || '[]');
        });
        return rows;
    } catch (err) {
        debug("loadSlides()", err.message);
        return Promise.reject(err);
    }
}


exports.getSlides = async (req, res) => {
    try {
        const {id} = req.params;
        const slides = await loadSlides({id, all: true});
        res.json({slides})
    } catch(err) {
        debug("getSlides()", err.message);
        res.json({error: err.message, name: err.name});
    }
};

exports.getActiveSlides = async (req, res) => {
    try {
        const slides = await loadSlides({all: false});
        res.json({slides})

    } catch(err) {
        debug("getActiveSlides()", err.message);
        res.json({error: err.message, name: err.name});
    }
};

exports.loadSlides = loadSlides;
