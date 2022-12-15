import { ProductColorVariant } from "b2b-types";
import { Request, Response } from "express";
export interface LoadItemsProps {
    id?: number | string;
    productId?: number | string;
    productIdList?: (number | string)[];
}
export declare function loadProductItems({ id, productId, productIdList }: LoadItemsProps): Promise<ProductColorVariant[]>;
export declare function getProductItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postProductItem(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function delProductItem(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
