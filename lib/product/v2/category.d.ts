import { Request, Response } from "express";
import { ProductCategory } from "b2b-types";
interface LoadCategoriesProps {
    id?: string | number | null;
    parentId?: string | number | null;
    keyword?: string | null;
}
export declare function loadCategories({ id, parentId, keyword }: LoadCategoriesProps): Promise<ProductCategory[]>;
interface LoadCategoryProps {
    keyword?: string | null;
    id?: string | number | null;
}
export declare function loadCategory({ keyword, id }: LoadCategoryProps): Promise<ProductCategory>;
export declare function getCategory(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getCategories(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getCategoryItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postCategory(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function delCategory(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postCategoryItem(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postItemSort(req: any, res: any): Promise<any>;
export declare function delCategoryItem(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export {};
