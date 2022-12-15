import { BasicProduct } from "b2b-types";
import { Request, Response } from "express";
import { SellAsColorsProduct, SellAsMixProduct, SellAsSelfProduct, SellAsVariantsProduct } from "b2b-types/src/products";
export type Product = BasicProduct | SellAsSelfProduct | SellAsVariantsProduct | SellAsMixProduct | SellAsColorsProduct;
interface LoadProductProps {
    id?: string | number;
    keyword?: string | number;
    complete?: boolean;
}
export declare function loadProduct({ id, keyword, complete }: LoadProductProps): Promise<Product | undefined>;
export declare function saveProduct(params: BasicProduct): Promise<BasicProduct | undefined>;
export interface LoadVariantsProps {
    productId: string | number;
    id?: string | number;
}
export declare function getProduct(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postProduct(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getProductList(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getVariantsList(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getVariant(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postVariant(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function delVariant(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postVariantSort(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postSetDefaultVariant(req: Request, res: Response): Promise<undefined>;
export {};
