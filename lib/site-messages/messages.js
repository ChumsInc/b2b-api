import Debug from "debug";
import {mysql2Pool} from "chums-local-modules";

const debug = Debug('chums:lib:site-messages:messages');


export async function loadMessages({id = null} = {}) {
    try {
        const query = `SELECT id,
                              type,
                              description,
                              message,
                              start,
                              end,
                              active,
                              allow_nextday,
                              allow_twoday
                       FROM b2b_oscommerce.site_messages
                       WHERE id = :id
                          OR :id IS NULL`;
        const data = {id};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadMessages()", err.message);
        return Promise.reject(err);
    }
}

export async function loadCurrentMessages() {
    try {
        const now = new Date().valueOf();
        const messages = await loadMessages();
        return messages.filter(m => {
            return m.active !== 0
                && (m.start === null || new Date(m.start).valueOf() <= now)
                && (m.end === null || new Date(m.end).valueOf() >= now)
        });
    } catch (err) {
        debug("loadCurrentMessages()", err.message);
        return Promise.reject(err);
    }
}

async function saveNewMessage({type = 'site', description = '', message = '', start = null, end = null, active = 0}) {
    try {
        const query = `INSERT INTO b2b_oscommerce.site_messages (type, description, message, start, end, active)
                       VALUES (:type, :description, :message, :start, :end, :active)`;
        const data = {type, description, message, start, end, active};
        const [result] = await mysql2Pool.query(query, data);
        return loadMessages({id: result.insertId});
    } catch (err) {
        debug("saveNewMessage()", err.message);
        return Promise.reject(err);
    }

}

export async function saveMessage({
                               id = 0,
                               type = 'site',
                               description = '',
                               message = '',
                               start = null,
                               end = null,
                               active = 0
                           }) {
    try {
        if (!id) {
            return await saveNewMessage({type, description, message, start, end, active});
        }
        const query = `UPDATE b2b_oscommerce.site_messages
                       SET type = :type,
                           description = :description,
                           message = :message,
                           start = :start,
                           end = :end,
                           active = :active
                       WHERE id = :id`;
        const data = {id, type, description, message, start, end, active};
        await mysql2Pool.query(query, data);
        return await loadMessages({id});
    } catch (err) {
        debug("saveMessage()", err.message);
        return Promise.reject(err);
    }
}

export async function deleteMessage({id}) {
    try {
        const query = `DELETE FROM b2b_oscommerce.site_messages WHERE id = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
        return await loadMessages();
    } catch (err) {
        debug("deleteMessage()", err.message);
        return Promise.reject(err);
    }
}
