import Debug from "debug";
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:menus:menu');
const defaultMenu = {
    id: 0,
    title: '',
    description: '',
    className: '',
    status: false,
};
const defaultMenuItem = {
    id: 0,
    parentId: 0,
    menuId: 0,
    title: '',
    description: '',
    className: '',
    priority: 0,
    url: '',
    status: false,
};
async function loadParentMenuList(id) {
    try {
        id = Number(id);
        const query = `SELECT DISTINCT parent_menu_id AS id
                       FROM b2b_oscommerce.menu_items
                       WHERE child_menu_id = :id`;
        const data = { id };
        const [rows] = await mysql2Pool.query(query, data);
        if (rows.length === 0) {
            return [id];
        }
        const [parents] = await Promise.all(rows.map(row => loadParentMenuList(row.id)));
        return [id, ...parents];
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadParentMenuList()", err.message);
            return Promise.reject(err);
        }
        debug("loadParentMenuList()", err);
        return Promise.reject(new Error('Error in loadParentMenuList()'));
    }
}
export async function loadMenus(id = null, options) {
    try {
        const query = `SELECT menu_id AS id,
                              title,
                              description,
                              class   AS className,
                              status
                       FROM b2b_oscommerce.menu
                       WHERE (IFNULL(:id, '') = '' OR menu_id = :id)
                         AND (IFNULL(:includeInactive, '') = '1' OR status = 1)
        `;
        const data = { id };
        const [rows] = await mysql2Pool.query(query, data);
        if (rows.length === 1 && !!id) {
            rows[0].items = await loadItems(id, null, options);
            rows[0].parents = await loadParentMenuList(id);
        }
        return rows.map(row => ({
            ...row,
            status: !!row.status,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadMenus()", err.message);
            return Promise.reject(err);
        }
        debug("loadMenus()", err);
        return Promise.reject(new Error('Error in loadMenus()'));
    }
}
export async function loadMenu(id, options) {
    try {
        const [menu] = await loadMenus(id, options);
        return menu ?? null;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadMenu()", err.message);
            return Promise.reject(err);
        }
        debug("loadMenu()", err);
        return Promise.reject(new Error('Error in loadMenu()'));
    }
}
async function saveNewMenu({ ...body }) {
    try {
        const query = `INSERT INTO b2b_oscommerce.menu (title, description, class, status)
                       VALUES (:title, :description, :className, :status)`;
        const data = { ...defaultMenu, ...body };
        const [{ insertId }] = await mysql2Pool.query(query, data);
        return await loadMenu(insertId, { includeInactive: true });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveNewMenu()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewMenu()", err);
        return Promise.reject(new Error('Error in saveNewMenu()'));
    }
}
async function saveMenu({ ...body }) {
    try {
        if (!body.id) {
            return saveNewMenu({ ...body });
        }
        const query = `UPDATE b2b_oscommerce.menu
                       SET title       = :title,
                           description = :description,
                           class       = :className,
                           status      = :status
                       WHERE menu_id = :id`;
        const data = { ...defaultMenu, ...body };
        await mysql2Pool.query(query, data);
        return await loadMenu(body.id, { includeInactive: true });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveMenu()", err.message);
            return Promise.reject(err);
        }
        debug("saveMenu()", err);
        return Promise.reject(new Error('Error in saveMenu()'));
    }
}
async function deleteMenu(id) {
    try {
        const items = await loadItems(id);
        if (items.length) {
            return Promise.reject(new Error('Unable to delete: still contains items'));
        }
        const query = `DELETE
                       FROM b2b_oscommerce.menu
                       WHERE menu_id = :id`;
        const data = { id };
        await mysql2Pool.query(query, data);
        return await loadMenus();
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteMenu()", err.message);
            return Promise.reject(err);
        }
        debug("deleteMenu()", err);
        return Promise.reject(new Error('Error in deleteMenu()'));
    }
}
async function loadItems(parentId, id = null, options) {
    try {
        const query = `SELECT item_id        AS id,
                              parent_menu_id AS parentId,
                              child_menu_id  AS menuId,
                              title,
                              description,
                              class          AS className,
                              priority,
                              url,
                              status,
                              require_login  AS requireLogin
                       FROM b2b_oscommerce.menu_items
                       WHERE parent_menu_id = :parentId
                         AND (item_id = :id OR IFNULL(:id, '') = '')
                         AND (IFNULL(:includeInactive, '') = '1' OR status = 1)
                       ORDER BY priority, title`;
        const data = { parentId, id, includeInactive: options?.includeInactive ?? 0 };
        const [rows] = await mysql2Pool.query(query, data);
        const childMenus = await Promise.all(rows.filter(row => !!row.menuId)
            .map((row) => {
            return loadMenus(row.menuId, options);
        }));
        return rows.map(row => {
            const [menu] = childMenus.map(([menu]) => menu).filter(menu => menu.id === row.menuId);
            return {
                ...row,
                status: !!row.status,
                requireLogin: !!row.requireLogin,
                menu,
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadItems()", err.message);
            return Promise.reject(err);
        }
        debug("loadItems()", err);
        return Promise.reject(new Error('Error in loadItems()'));
    }
}
async function saveNewItem({ ...body }) {
    try {
        const query = `INSERT INTO b2b_oscommerce.menu_items (parent_menu_id, child_menu_id, title, description, class,
                                                              priority, url,
                                                              status)
                       VALUES (:parentId, :menuId, :title, :description, :className, :priority, :url, :status)`;
        const data = { ...defaultMenuItem, ...body };
        const [{ insertId }] = await mysql2Pool.query(query, data);
        const [item] = await loadItems(body.parentId, insertId);
        return item;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveNewItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewItem()", err);
        return Promise.reject(new Error('Error in saveNewItem()'));
    }
}
async function saveItem({ ...body }) {
    try {
        if (!body.id) {
            return saveNewItem({ ...body });
        }
        const query = `UPDATE b2b_oscommerce.menu_items
                       SET parent_menu_id = :parentId,
                           title          = :title,
                           description    = :description,
                           class          = :className,
                           child_menu_id  = :menuId,
                           priority       = :priority,
                           url            = :url,
                           status         = :status
                       WHERE item_id = :id`;
        const data = { ...defaultMenuItem, ...body };
        await mysql2Pool.query(query, data);
        const [item] = await loadItems(body.parentId, body.id);
        return item;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveItem()", err);
        return Promise.reject(new Error('Error in saveItem()'));
    }
}
async function deleteItem(parentId, id) {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.menu_items
                       WHERE item_id = :id
                         AND parent_menu_id = :parentId`;
        const data = { id, parentId };
        await mysql2Pool.query(query, data);
        return await loadItems(parentId);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteItem()", err.message);
            return Promise.reject(err);
        }
        debug("deleteItem()", err);
        return Promise.reject(new Error('Error in deleteItem()'));
    }
}
async function updateItemSort(parentId, items = []) {
    try {
        const query = `UPDATE b2b_oscommerce.menu_items
                               SET priority = :priority
                               WHERE item_id = :id`;
        await Promise.all(items.map((id, index) => {
            const data = { id, priority: index };
            return mysql2Pool.query(query, data);
        }));
        return await loadItems(parentId);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("updateItemSort()", err.message);
            return Promise.reject(err);
        }
        debug("updateItemSort()", err);
        return Promise.reject(new Error('Error in updateItemSort()'));
    }
}
export const getMenus = async (req, res) => {
    try {
        const menus = await loadMenus(req.params.id, { includeInactive: true });
        res.json({ menus });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getMenus()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getMenus' });
    }
};
export const getMenu = async (req, res) => {
    try {
        const menu = await loadMenu(req.params.id, { includeInactive: true });
        res.json({ menu });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getMenus()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getMenus' });
    }
};
export const getActiveMenus = async (req, res) => {
    try {
        const menus = await loadMenus(req.params.id);
        res.json({ menus });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getActiveMenus()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getActiveMenus' });
    }
};
export const getActiveMenu = async (req, res) => {
    try {
        const menu = await loadMenu(req.params.id);
        res.json({ menu });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getActiveMenus()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getActiveMenus' });
    }
};
export const getMenuItems = async (req, res) => {
    try {
        const items = await loadItems(req.params.parentId, req.params.id, { includeInactive: true });
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getMenuItems()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getMenuItems' });
    }
};
export const getParents = async (req, res) => {
    try {
        const parents = await loadParentMenuList(req.params.id);
        res.json({ parents });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getParents()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getParents' });
    }
};
export const postMenu = async (req, res) => {
    try {
        const menu = await saveMenu({ ...req.body });
        res.json({ menu });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postMenu()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in postMenu' });
    }
};
export const delMenu = async (req, res) => {
    try {
        const menus = await deleteMenu(req.params.id);
        res.json({ menus });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delMenu()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in delMenu' });
    }
};
export const postMenuItem = async (req, res) => {
    try {
        const item = await saveItem({ ...req.body });
        res.json({ item });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postMenuItem()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in postMenuItem' });
    }
};
export const delMenuItem = async (req, res) => {
    try {
        const items = await deleteItem(req.params.parentId, req.params.id);
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delMenuItem()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in delMenuItem' });
    }
};
export const postItemSort = async (req, res) => {
    try {
        const items = await updateItemSort(req.params.parentId, req.body.items ?? []);
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postItemSort()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in postItemSort' });
    }
};
