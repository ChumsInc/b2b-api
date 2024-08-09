import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';
import {ProductCategoryChild} from "b2b-types";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {loadProduct} from './product.js';
import {loadCategories} from './category.js';
import {CategoryChildCategory, CategoryChildProduct} from "b2b-types";

const debug = Debug('chums:lib:product:v2:category-items');

type CategoryItemRow = ProductCategoryChild & RowDataPacket;

export interface ProductUsage {
    categorypage_id: number;
    page_keyword: string;
    page_title: string;
    item_title: string;
    item_status: boolean;
    products_keyword: string;
    products_status: boolean;
}
interface ProductUsageRow extends Omit<ProductUsage, 'item_status'|'products_status'> {
    item_status: 1|0;
    products_status: 1|0;
}

export interface CategoryUsage {
    categorypage_id: number;
    page_keyword: string;
    page_title: string;
    item_title: string;
    item_status: boolean;
}
interface CategoryUsageRow extends Omit<CategoryUsage, 'item_status'> {
    item_status: 1|0;
}

export interface MenuUsage {
    menu_id: number;
    title: string;
    menu_status: boolean;
    item_title: string;
    url: string;
    item_status: boolean;
}
interface MenuUsageRow extends Omit<MenuUsage, 'menu_status'|'item_status'> {
    menu_status: 1|0;
    item_status: 1|0;
}



export async function loadCategoryItemComponents(row: ProductCategoryChild): Promise<ProductCategoryChild> {
    try {
        if (row.productsId) {
            const product = await loadProduct({id: row.productsId});
            return {
                ...row,
                product,
            } as CategoryChildProduct
        }

        if (row.categoriesId) {
            const [category] = await loadCategories({id: row.categoriesId});
            return {
                ...row,
                category,
            } as CategoryChildCategory
        }

        return row;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadComponents()", err.message);
            return Promise.reject(err);
        }
        debug("loadComponents()", err);
        return Promise.reject(new Error('Error in loadComponents()'));
    }
}

export interface LoadCategoryItemsProps {
    id?: number | string | null,
    parentId?: number | string | null,
    keyword?: string | null,
}

export async function loadCategoryItems({
                                            id = null,
                                            parentId = null,
                                            keyword
                                        }: LoadCategoryItemsProps): Promise<ProductCategoryChild[]> {
    try {
        const query = `SELECT item_id             AS id,
                              categorypage_id     AS parentId,
                              itemType,
                              section_title       AS sectionTitle,
                              section_description AS sectionDescription,
                              item_title          AS title,
                              item_text           AS description,
                              item_url            AS urlOverride,
                              item_class          AS className,
                              item_image_url      AS imageUrl,
                              products_id         AS productsId,
                              categories_id       AS categoriesId,
                              priority,
                              status,
                              timestamp
                       FROM b2b_oscommerce.category_pages_items
                       WHERE (IFNULL(:id, '') = '' OR item_id = :id)
                         AND (IFNULL(:parentId, '') = '' OR categorypage_id = :parentId)
                         AND (IFNULL(:keyword, '') = '' OR categorypage_id = (SELECT categorypage_id
                                                                              FROM b2b_oscommerce.category_pages
                                                                              WHERE page_keyword = :keyword
                                                                              LIMIT 1))
                       ORDER BY priority`;
        const data = {id, parentId, keyword};

        const [rows] = await mysql2Pool.query<CategoryItemRow[]>(query, data);

        return await Promise.all(rows.map(row => loadCategoryItemComponents(row)));
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadItems()", err.message);
            return Promise.reject(err);
        }
        debug("loadItems()", err);
        return Promise.reject(new Error('Error in loadItems()'));
    }
}

export async function findProductUsage(keyword:string):Promise<ProductUsage[]> {
    try {
        const sql = `SELECT cp.categorypage_id,
                            cp.page_keyword,
                            cp.page_title,
                            i.item_title,
                            i.status as item_status,
                            p.products_keyword,
                            p.products_status
                     FROM b2b_oscommerce.category_pages cp
                              INNER JOIN b2b_oscommerce.category_pages_items i on i.categorypage_id = cp.categorypage_id
                              inner join b2b_oscommerce.products p on p.products_id = i.products_id
                     where p.products_keyword = :keyword`
        const [rows] = await mysql2Pool.query<(ProductUsageRow & RowDataPacket)[]>(sql, {keyword});
        return rows.map(row => {
            return {
                ...row,
                item_status: !!row.item_status,
                products_status: !!row.products_status,
            }
        });
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("findProductUsage()", err.message);
            return Promise.reject(err);
        }
        debug("findProductUsage()", err);
        return Promise.reject(new Error('Error in findProductUsage()'));
    }
}

export async function findCategoryUsage(keyword:string):Promise<CategoryUsage[]> {
    try {
        const sql = `SELECT cp.categorypage_id,
                            cp.page_keyword,
                            cp.page_title,
                            i.item_title,
                            i.status as item_status
                     FROM b2b_oscommerce.category_pages cp
                              INNER JOIN b2b_oscommerce.category_pages_items i on i.categorypage_id = cp.categorypage_id
                     INNER JOIN b2b_oscommerce.category_pages cp2 on cp2.categorypage_id = i.categories_id
                     where cp2.page_keyword = :keyword`
        const [rows] = await mysql2Pool.query<(CategoryUsageRow & RowDataPacket)[]>(sql, {keyword});
        return rows.map(row => {
            return {
                ...row,
                item_status: !!row.item_status,
            }
        });
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("findCategoryUsage()", err.message);
            return Promise.reject(err);
        }
        debug("findCategoryUsage()", err);
        return Promise.reject(new Error('Error in findCategoryUsage()'));
    }
}

export async function findMenuUsage(keyword:string):Promise<MenuUsage[]> {
    try {
        const sql = `SELECT m.menu_id,
                            m.title,
                            m.status  as menu_status,
                            mi.title  as item_title,
                            mi.url,
                            mi.status as item_status
                     FROM b2b_oscommerce.menu m
                              inner join b2b_oscommerce.menu_items mi on mi.parent_menu_id = m.menu_id
                              inner join b2b_oscommerce.category_pages cp on concat('/', cp.page_keyword) = mi.url
                     where cp.page_keyword = :keyword`
        const [rows] = await mysql2Pool.query<(MenuUsageRow & RowDataPacket)[]>(sql, {keyword});
        return rows.map(row => {
            return {
                ...row,
                menu_status: !!row.menu_status,
                item_status: !!row.item_status,
            }
        });

    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadMenuUsage()", err.message);
            return Promise.reject(err);
        }
        debug("loadMenuUsage()", err);
        return Promise.reject(new Error('Error in loadMenuUsage()'));
    }
}


async function saveNewCategoryItem({...body}: ProductCategoryChild): Promise<ProductCategoryChild> {
    try {
        const query = `INSERT INTO b2b_oscommerce.category_pages_items
                       (categorypage_id, itemType, section_title, section_description,
                        item_title, item_text, item_url, item_class,
                        item_image_url, products_id, categories_id, priority,
                        status)
                       VALUES (:parentId, :itemType, :sectionTitle, :sectionDescription, :title, :description,
                               :urlOverride, :className, :imageUrl, :productsId, :categoriesId, :priority,
                               :status)`;
        const data = {...body};

        const [{insertId}] = await mysql2Pool.query<ResultSetHeader>(query, data);
        const [item] = await loadCategoryItems({id: insertId});
        return item;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveNewItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveNewItem()", err);
        return Promise.reject(new Error('Error in saveNewItem()'));
    }
}

export async function saveCategoryItem({...body}: ProductCategoryChild): Promise<ProductCategoryChild> {
    try {
        if (!body.id) {
            return saveNewCategoryItem({...body});
        }
        const query = `UPDATE b2b_oscommerce.category_pages_items
                       SET categorypage_id     = :parentId,
                           itemType            = :itemType,
                           section_title       = :sectionTitle,
                           section_description = :sectionDescription,
                           item_title          = :title,
                           item_text           = :description,
                           item_url            = :urlOverride,
                           item_class          = :className,
                           item_image_url      = :imageUrl,
                           products_id         = :productsId,
                           categories_id       = :categoriesId,
                           priority            = :priority,
                           status              = :status
                       WHERE item_id = :id`;
        const data = {...body};

        await mysql2Pool.query(query, data);
        const [item] = await loadCategoryItems({id: body.id});
        return item;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("saveItem()", err.message);
            return Promise.reject(err);
        }
        debug("saveItem()", err);
        return Promise.reject(new Error('Error in saveItem()'));
    }
}


export interface UpdateCategoryItemSortProps {
    parentId: string | number,
    items: {
        id: number,
        priority: number
    }[]
}

export async function updateCategoryItemSort({parentId, items = []}: UpdateCategoryItemSortProps) {
    try {
        const query = `UPDATE b2b_oscommerce.category_pages_items
                       SET priority = :priority
                       WHERE item_id = :id`;
        const connection = await mysql2Pool.getConnection();
        await Promise.all(items.map(item => {
            return connection.query(query, {...item});
        }));
        connection.release();
        return await loadCategoryItems({parentId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("updateItemSort()", err.message);
            return Promise.reject(err);
        }
        debug("updateItemSort()", err);
        return Promise.reject(new Error('Error in updateItemSort()'));
    }
}

export interface DeleteCategoryItemProps {
    id: number | string,
    parentId: number | string,
}

export async function deleteCategoryItem({id, parentId}: DeleteCategoryItemProps): Promise<ProductCategoryChild[]> {
    try {
        const query = `DELETE
                       FROM b2b_oscommerce.category_pages_items
                       WHERE item_id = :id`;
        const data = {id};
        await mysql2Pool.query(query, data);
        return await loadCategoryItems({parentId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("deleteItem()", err.message);
            return Promise.reject(err);
        }
        debug("deleteItem()", err);
        return Promise.reject(new Error('Error in deleteItem()'));
    }
}
