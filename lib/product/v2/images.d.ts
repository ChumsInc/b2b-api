import { ProductAlternateImage } from "b2b-types";
import { NextFunction, Request, Response } from "express";
export interface LoadImagesProps {
    id?: string | number;
    productId?: number | string;
    productIdList?: (string | number)[];
}
export declare function loadImages({ id, productId, productIdList }: LoadImagesProps): Promise<ProductAlternateImage[]>;
export interface DeleteImageProps {
    id: string | number;
    productId: string | number;
}
export declare function getImages(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getImage(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postImage(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function delImage(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getImagesForProducts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
