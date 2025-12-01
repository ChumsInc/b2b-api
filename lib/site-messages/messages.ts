import Debug from "debug";
import {mysql2Pool} from "chums-local-modules";
import {Message} from "chums-types/b2b";
import {ResultSetHeader, RowDataPacket} from "mysql2";

const debug = Debug('chums:lib:site-messages:messages');

interface MessageRow extends RowDataPacket, Omit<Message, 'active' | 'allow_nextday' | 'allow_twoday'> {
    active: number;
    allow_nextday: number,
    allow_twoday: number;
}

export async function loadMessages(id: number | string | null = null): Promise<Message[]> {
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
        const [rows] = await mysql2Pool.query<MessageRow[]>(query, data);
        return rows.map(row => ({
            ...row,
            active: !!row.active,
            allow_nextday: !!row.allow_nextday,
            allow_twoday: !!row.allow_twoday
        }));
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadMessages()", err.message);
            return Promise.reject(err);
        }
        debug("loadMessages()", err);
        return Promise.reject(new Error('Error in loadMessages()'));
    }
}

export async function loadCurrentMessages(): Promise<Message[]> {
    try {
        const now = new Date().valueOf();
        const messages = await loadMessages();
        return messages.filter(m => {
            return m.active
                && (m.start === null || new Date(m.start).valueOf() <= now)
                && (m.end === null || new Date(m.end).valueOf() >= now)
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCurrentMessages()", err.message);
            return Promise.reject(err);
        }
        debug("loadCurrentMessages()", err);
        return Promise.reject(new Error('Error in loadCurrentMessages()'));
    }
}

async function saveNewMessage(message: Omit<Message, 'id'>): Promise<Message | null> {
    try {
        const query = `INSERT INTO b2b_oscommerce.site_messages (type, description, message, start, end, active)
                       VALUES (:type, :description, :message, :start, :end, :active)`;
        const data = {
            type: message.type ?? 'site',
            description: message.description,
            message: message.message,
            start: message.start,
            end: message.end,
            active: message.active ?? false
        };
        const [result] = await mysql2Pool.query<ResultSetHeader>(query, data);
        const [_message] = await loadMessages(result.insertId);
        return _message ?? null;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveNewMessage()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewMessage()", err);
        return Promise.reject(new Error('Error in saveNewMessage()'));
    }

}

export async function saveMessage(message: Omit<Message, 'id'> & Partial<Pick<Message, 'id'>>): Promise<Message | null> {
    try {
        if (!message.id) {
            return await saveNewMessage(message);
        }
        const query = `UPDATE b2b_oscommerce.site_messages
                       SET type = :type,
                           description = :description,
                           message = :message,
                           start = :start,
                           end = :end,
                           active = :active
                       WHERE id = :id`;
        const data = {
            id: message.id,
            type: message.type,
            description: message.description,
            message: message.message,
            start: message.start,
            end: message.end,
            active: message.active ?? false
        };
        await mysql2Pool.query(query, data);
        const [_message] = await loadMessages(message.id);
        return _message ?? null;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveMessage()", err.message);
            return Promise.reject(err);
        }
        debug("saveMessage()", err);
        return Promise.reject(new Error('Error in saveMessage()'));
    }
}

export async function deleteMessage(id: number | string) {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.site_messages
                       WHERE id = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
        return await loadMessages();
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("deleteMessage()", err.message);
            return Promise.reject(err);
        }
        debug("deleteMessage()", err);
        return Promise.reject(new Error('Error in deleteMessage()'));
    }
}
