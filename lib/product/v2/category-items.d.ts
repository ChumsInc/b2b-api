import { ProductCategoryChild } from "b2b-types";
export declare function loadCategoryItemComponents(row: ProductCategoryChild): Promise<ProductCategoryChild>;
export interface LoadCategoryItemsProps {
    id?: number | string | null;
    parentId?: number | string | null;
    keyword?: string | null;
}
export declare function loadCategoryItems({ id, parentId, keyword }: LoadCategoryItemsProps): Promise<ProductCategoryChild[]>;
export declare function saveCategoryItem({ ...body }: ProductCategoryChild): Promise<ProductCategoryChild>;
export interface UpdateCategoryItemSortProps {
    parentId: string | number;
    items: {
        id: number;
        priority: number;
    }[];
}
export declare function updateCategoryItemSort({ parentId, items }: UpdateCategoryItemSortProps): Promise<ProductCategoryChild[]>;
export interface DeleteCategoryItemProps {
    id: number | string;
    parentId: number | string;
}
export declare function deleteCategoryItem({ id, parentId }: DeleteCategoryItemProps): Promise<ProductCategoryChild[]>;
