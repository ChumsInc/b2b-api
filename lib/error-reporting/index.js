const debug = require('debug')('chums:lib:error-reporting');
const {mysql2Pool} = require('chums-local-modules');

async function logErrors({ip, version, user_id, message, componentStack, debug, user_agent, referrer, url}) {
    try {
        const sql = `INSERT INTO b2b.user_errors (ip_address, version, user_id, url, message, componentStack, debug,
                                                  user_agent, referrer)
                     VALUES (:ip_address, :version, :user_id, :url, :message, :componentStack, :debug, :user_agent,
                             :referrer)`;
        const args = {
            ip_address: ip,
            version,
            user_id,
            url,
            message,
            componentStack,
            debug: JSON.stringify(debug),
            user_agent,
            referrer
        };
        await mysql2Pool.query(sql, args);
    } catch (err) {
        debug("logErrors()", err.message);
        return Promise.reject(err);
    }
}

async function loadErrors({ip, user_id, limit = 0, offset = 0}) {
    try {
        limit = Number(limit) || 100;
        offset = Number(offset) || 0;
        const sql = `SELECT id,
                            version,
                            ip_address,
                            user_id,
                            url,
                            componentStack,
                            debug,
                            message,
                            user_agent,
                            referrer,
                            timestamp
                     FROM b2b.user_errors
                     WHERE (IFNULL(:ip, '') = :ip OR ip_address = :ip)
                       AND (IFNULL(:user_id, 0) = 0 OR user_id = :user_id)
                     ORDER BY id DESC
                     LIMIT :limit OFFSET :offset`;
        const args = {ip, user_id, limit, offset};
        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.debug = JSON.parse(row.debug);
        })
        return rows;
    } catch (err) {
        debug("loadErrors()", err.message);
        return Promise.reject(err);
    }
}

async function post(req, res) {
    try {
        const ip = req.ip;
        const user_agent = req.get('User-Agent');
        const referrer = req.get('referrer');
        const {user_id, url, message, componentStack, version, debug, state, trace} = req.body;
        await logErrors({ip, version, user_id, url, message, componentStack, debug, user_agent, referrer});
        res.json({logged: true});
    } catch (err) {
        debug("post()", err.message);
        res.json({logged: false});
    }
}

exports.post = post;
