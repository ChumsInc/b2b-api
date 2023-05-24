import Debug from "debug";

const debug = Debug('chums:lib:menus:menu');
import {mysql2Pool} from 'chums-local-modules';
import {Menu, MenuItem} from "b2b-types";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {Request, Response} from "express";

const DEFAULT_MENU:Menu = {
    id: 0,
    title: '',
    description: '',
    className: '',
    status: 0,
};

const DEFAULT_MENU_ITEM:MenuItem = {
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

const loadParentMenuList = async (id:number|string):Promise<number[]> => {
    try {
        id = Number(id);
        const query = `SELECT DISTINCT parent_menu_id as id
                       FROM b2b_oscommerce.menu_items
                       WHERE child_menu_id = :id`;
        const data = {id};
        const [rows] = await mysql2Pool.query<RowDataPacket[]>(query, data);
        if (rows.length === 0) {
            return [id];
        }
        const [parents] = await Promise.all(rows.map(row => loadParentMenuList(row.id)));
        return [id, ...parents];
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadParentMenuList()", err.message);
            return Promise.reject(err);
        }
        debug("loadParentMenuList()", err);
        return Promise.reject(new Error('Error in loadParentMenuList()'));
    }
};

export const loadMenus = async (id:number|string|null = null):Promise<Menu[]> => {
    try {
        const query = `SELECT menu_id AS id,
                              title,
                              description,
                              class   AS className,
                              status
                       FROM b2b_oscommerce.menu
                       WHERE (ifnull(:id, '') = '' OR menu_id = :id)`;
        const data = {id};
        const [rows] = await mysql2Pool.query<(Menu & RowDataPacket)[]>(query, data);
        if (rows.length === 1 && !!id) {
            rows[0].items = await loadItems(id);
            rows[0].parents = await loadParentMenuList(id);
        }
        return rows;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadMenus()", err.message);
            return Promise.reject(err);
        }
        debug("loadMenus()", err);
        return Promise.reject(new Error('Error in loadMenus()'));
    }
};

const saveNewMenu = async ({...body}:Menu):Promise<Menu> => {
    try {
        const query = `INSERT INTO b2b_oscommerce.menu (title, description, class, status)
                       VALUES (:title, :description, :className, :status)`;
        const data = {...DEFAULT_MENU, ...body};
        const [{insertId}] = await mysql2Pool.query<ResultSetHeader>(query, data);
        const [menu] = await loadMenus(insertId);
        return menu;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("saveNewMenu()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewMenu()", err);
        return Promise.reject(new Error('Error in saveNewMenu()'));
    }
};

const saveMenu = async ({...body}:Menu):Promise<Menu> => {
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
        const [menu] = await loadMenus(body.id);
        return menu;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("saveMenu()", err.message);
            return Promise.reject(err);
        }
        debug("saveMenu()", err);
        return Promise.reject(new Error('Error in saveMenu()'));
    }
};

const deleteMenu = async (id:string|number) => {
    try {
        const items = await loadItems(id);
        if (items.length) {
            return Promise.reject(new Error('Unable to delete: still contains items'));
        }
        const query = `DELETE FROM b2b_oscommerce.menu WHERE menu_id = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
        return await loadMenus();
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("deleteMenu()", err.message);
            return Promise.reject(err);
        }
        debug("deleteMenu()", err);
        return Promise.reject(new Error('Error in deleteMenu()'));
    }
};

const loadItems = async (parentId: string|number, id: string|number|null = null):Promise<MenuItem[]> => {
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
                         AND (item_id = :id OR ifnull(:id, '') = '')
                       ORDER BY priority, title`;
        const data = {parentId, id};
        const [rows] = await mysql2Pool.query<(MenuItem & RowDataPacket)[]>(query, data);
        const childMenus = await Promise.all(rows.filter(row => !!row.menuId).map((row) => {
            return loadMenus(row.menuId);
        }));
        return rows.map(row => {
            const [menu] = childMenus.map(([menu]) => menu).filter(menu => menu.id === row.menuId);
            return {
                ...row,
                menu,
            }
        });
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadItems()", err.message);
            return Promise.reject(err);
        }
        debug("loadItems()", err);
        return Promise.reject(new Error('Error in loadItems()'));
    }
};

const saveNewItem = async ({...body}:MenuItem):Promise<MenuItem> => {
    try {
        const query = `INSERT INTO b2b_oscommerce.menu_items (parent_menu_id, child_menu_id, title, description, class, priority, url,
                                               status)
                       VALUES (:parentId, :menuId, :title, :description, :className, :priority, :url, :status)`;
        const data = {...DEFAULT_MENU_ITEM, ...body};
        const [{insertId}] = await mysql2Pool.query<ResultSetHeader>(query, data);
        const [item] = await loadItems(body.parentId, insertId);
        return item;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("saveNewItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewItem()", err);
        return Promise.reject(new Error('Error in saveNewItem()'));
    }
};

const saveItem = async ({...body}:MenuItem):Promise<MenuItem> => {
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
        const [item] = await loadItems(body.parentId, body.id);
        return item;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("saveItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveItem()", err);
        return Promise.reject(new Error('Error in saveItem()'));
    }
};

const deleteItem = async (parentId:number|string, id:number|string) => {
    try {
        const query = `DELETE FROM b2b_oscommerce.menu_items WHERE item_id = :id AND parent_menu_id = :parentId`;
        const data = {id, parentId};
        await mysql2Pool.query(query, data);
        return await loadItems(parentId);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("deleteItem()", err.message);
            return Promise.reject(err);
        }
        debug("deleteItem()", err);
        return Promise.reject(new Error('Error in deleteItem()'));
    }
};

/**
 *
 * @param parentId
 * @param items array of item id (in order or priority)
 * @return {Promise<*>}
 */
const updateItemSort = async (parentId:number|string, items:(number|string)[] = []) => {
    try {
        const query:string = `UPDATE b2b_oscommerce.menu_items SET priority = :priority WHERE item_id = :id`;

        await Promise.all(items.map((id, priority) => {
            const data = {id, priority};
            return mysql2Pool.query(query, data);
        }));

        return await loadItems(parentId);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("updateItemSort()", err.message);
            return Promise.reject(err);
        }
        debug("updateItemSort()", err);
        return Promise.reject(new Error('Error in updateItemSort()'));
    }
};


export const getMenus = async (req:Request, res:Response) => {
    try {
        const menus = await loadMenus(req.params.id);
        res.json({menus});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getMenus()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getMenus'});
    }
};

export const getMenuItems = async (req:Request, res:Response) => {
    try {
        const items = await loadItems(req.params.parentId, req.params.id);
        res.json({items});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getMenuItems()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getMenuItems'});
    }
};

export const getParents = async (req:Request, res:Response) => {
    try {

        const parents = await loadParentMenuList(req.params.id);
        res.json({parents});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getParents()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getParents'});
    }
};

export const postMenu = async (req:Request, res:Response) => {
    try {
        const menu = await saveMenu({...req.body});
        res.json({menu});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postMenu()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postMenu'});
    }
};

export const delMenu = async (req:Request, res:Response) => {
    try {
        const menus = await deleteMenu(req.params.id);
        res.json({menus});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("delMenu()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delMenu'});
    }
};

export const postMenuItem = async (req:Request, res:Response) => {
    try {
        const item = await saveItem({...req.body});
        res.json({item});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postMenuItem()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postMenuItem'});
    }
};

export const delMenuItem = async (req:Request, res:Response) => {
    try {
        const items = await deleteItem(req.params.parentId, req.params.id);
        res.json({items});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("delMenuItem()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delMenuItem'});
    }
};

export const postItemSort = async (req:Request, res:Response) => {
    try {
        const items = await updateItemSort(req.params.parentId, req.body.items ?? []);
        res.json({items});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postItemSort()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postItemSort'});
    }
};





