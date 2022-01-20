"use strict";

const debug = require('debug')('chums:lib:menus:menu');
const {mysql2Pool} = require('chums-local-modules');

const DEFAULT_MENU = {
    id: 0,
    title: '',
    description: '',
    className: '',
    status: 0,
};

const DEFAULT_MENU_ITEM = {
    id: 0,
    parentId: 0,
    menuId: 0,
    title: '',
    description: '',
    className: '',
    priority: 0,
    url: '',
    status: 0,
};

const loadParentMenuList = async ({id}) => {
    try {
        id = Number(id);
        const query = `SELECT DISTINCT parent_menu_id as id
                       FROM b2b_oscommerce.menu_items
                       WHERE child_menu_id = :id`;
        const data = {id};
        const [rows] = await mysql2Pool.query(query, data);
        if (rows.length === 0) {
            return [id];
        }
        const [parents] = await Promise.all(rows.map(row => loadParentMenuList({id: row.id})));
        return [id, ...parents];
    } catch (err) {
        debug("loadParentMenuList()", err.message);
        return Promise.reject(err);
    }
};

const loadMenus = async ({id = null} = {}) => {
    try {
        const query = `SELECT menu_id AS id,
                              title,
                              description,
                              class   AS className,
                              status
                       FROM b2b_oscommerce.menu
                       WHERE (menu_id = :id OR :id IS NULL)`;
        const data = {id};
        const [rows] = await mysql2Pool.query(query, data);
        if (rows.length === 1) {
            rows[0].items = await loadItems({parentId: id});
            rows[0].parents = await loadParentMenuList({id});
        }
        return rows;
    } catch (err) {
        debug("loadMenus()", err.message);
        return Promise.reject(err);
    }
};

const saveNewMenu = async ({...body}) => {
    try {
        const query = `INSERT INTO b2b_oscommerce.menu (title, description, class, status)
                       VALUES (:title, :description, :className, :status)`;
        const data = {...DEFAULT_MENU, ...body};
        const [{insertId}] = await mysql2Pool.query(query, data);
        const [menu] = await loadMenus({id: insertId});
        return menu;
    } catch (err) {
        debug("saveNewMenu()", err.message);
        return Promise.reject(err);
    }
};

const saveMenu = async ({...body}) => {
    try {
        if (!body.id) {
            return saveNewMenu({...body});
        }
        const query = `UPDATE b2b_oscommerce.menu
                       SET title       = :title,
                           description = :description,
                           class       = :className,
                           status      = :status
                       WHERE menu_id = :id`;
        const data = {...DEFAULT_MENU, ...body};
        await mysql2Pool.query(query, data);
        const [menu] = await loadMenus({id: body.id});
        return menu;
    } catch (err) {
        debug("saveMenu()", err.message);
        return Promise.reject(err);
    }
};

const deleteMenu = async ({id}) => {
    try {
        const items = await loadItems({parentId: id});
        if (items.length) {
            return Promise.reject(new Error('Unable to delete: still contains items'));
        }
        const query = `DELETE FROM b2b_oscommerce.menu WHERE menu_id = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
        return await loadMenus();
    } catch (err) {
        debug("deleteMenu()", err.message);
        return Promise.reject(err);
    }
};

const loadItems = async ({parentId, id = null}) => {
    try {
        const query = `SELECT item_id        AS id,
                              parent_menu_id AS parentId,
                              child_menu_id  AS menuId,
                              title,
                              description,
                              class          AS className,
                              priority,
                              url,
                              status
                       FROM b2b_oscommerce.menu_items
                       WHERE parent_menu_id = :parentId
                         AND (item_id = :id OR :id IS NULL)`;
        const data = {parentId, id};
        const [rows] = await mysql2Pool.query(query, data);
        const childMenus = await Promise.all(rows.filter(row => !!row.menuId).map((row) => {
            return loadMenus({id: row.menuId});
        }));
        return rows.map(row => {
            const [menu] = childMenus.map(([menu]) => menu).filter(menu => menu.id === row.menuId);
            row.menu = menu;
            return row;
        });
    } catch (err) {
        debug("loadItems()", err.message);
        return Promise.reject(err);
    }
};

const saveNewItem = async ({...body}) => {
    try {
        const query = `INSERT INTO b2b_oscommerce.menu_items (parent_menu_id, child_menu_id, title, description, class, priority, url,
                                               status)
                       VALUES (:parentId, :menuId, :title, :description, :className, :priority, :url, :status)`;
        const data = {...DEFAULT_MENU_ITEM, ...body};
        const [{insertId}] = await mysql2Pool.query(query, data);
        const [item] = await loadItems({parentId: body.parentId, id: insertId});
        return item;
    } catch (err) {
        debug("saveNewItem()", err.message);
        return Promise.reject(err);
    }
};

const saveItem = async ({...body}) => {
    try {
        if (!body.id) {
            return saveNewItem({...body});
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
        const data = {...DEFAULT_MENU_ITEM, ...body};
        await mysql2Pool.query(query, data);
        const [item] = await loadItems({parentId: body.parentId, id: body.id});
        return item;
    } catch (err) {
        debug("saveMenuItem()", err.message);
        return Promise.reject(err);
    }
};

const deleteItem = async ({parentId, id}) => {
    try {
        const query = `DELETE FROM b2b_oscommerce.menu_items WHERE item_id = :id AND parent_menu_id = :parentId`;
        const data = {id, parentId};
        await mysql2Pool.query(query, data);
        return await loadItems({parentId: parentId});
    } catch (err) {
        debug("deleteItem()", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param parentId
 * @param items array of item id (in order or priority)
 * @return {Promise<*>}
 */
const updateItemSort = async ({parentId, items = []}) => {
    try {
        const query = `UPDATE b2b_oscommerce.menu_items SET priority = :priority WHERE item_id = :id`;
        const connection = await mysql2Pool.getConnection();
        await Promise.all(items.map((id, priority) => {
            const data = {id, priority};
            return connection.query(query, data);
        }));
        connection.release();
        return await loadItems({parentId});
    } catch (err) {
        debug("updateItemSort()", err.message);
        return Promise.reject(err);
    }
};


const getMenus = async (req, res) => {
    try {
        const menus = await loadMenus(req.params);
        res.json({menus});
    } catch(err) {
        debug("getMenus()", err.message);
        res.status(500).json({error: err.message});
    }
};

const getMenuItems = async (req, res) => {
    try {
        const items = await loadItems(req.params);
        res.json({items});
    } catch(err) {
        debug("getMenuItems()", err.message);
        res.status(500).json({error: err.message});
    }
};

const getParents = async (req, res) => {
    try {
        const parents = await loadParentMenuList(req.params);
        res.json({parents});
    } catch(err) {
        debug("getParents()", err.message);
        res.status(500).json({error: err.message});
    }
};

const postMenu = async (req, res) => {
    try {
        const menu = await saveMenu({...req.body});
        res.json({menu});
    } catch(err) {
        debug("postMenu()", err.message);
        res.status(500).json({error: err.message});
    }
};

const delMenu = async (req, res) => {
    try {
        const menus = await deleteMenu({...req.params});
        res.json({menus});
    } catch(err) {
        debug("delMenu()", err.message);
        res.status(500).json({error: err.message});
    }
};

const postMenuItem = async (req, res) => {
    try {
        const item = await saveItem({...req.body});
        res.json({item});
    } catch(err) {
        debug("postMenuItem()", err.message);
        res.status(500).json({error: err.message});
    }
};

const delMenuItem = async (req, res) => {
    try {
        const items = await deleteItem({...req.params});
        res.json({items});
    } catch(err) {
        debug("delMenuItem()", err.message);
        res.status(500).json({error: err.message});
    }
};

const postItemSort = async (req, res) => {
    try {
        const items = await updateItemSort({...req.params, ...req.body});
        res.json({items});
    } catch(err) {
        debug("postItemSort()", err.message);
        res.status(500).json({error: err.message});
    }
};

exports.loadMenus = loadMenus;

exports.getMenus = getMenus;
exports.getMenuItems = getMenuItems;
exports.getParents = getParents;
exports.postMenu = postMenu;
exports.postMenuItem = postMenuItem;
exports.postItemSort = postItemSort;
exports.delMenu = delMenu;
exports.delMenuItem = delMenuItem;




