import { ProductSeason } from "b2b-types";
import { RowDataPacket } from "mysql2";
import { Request, Response } from "express";
export interface ProductSeasonRow extends Omit<ProductSeason, 'active' | 'properties' | 'product_available'>, RowDataPacket {
    active: 1 | 0;
    properties?: string | null;
    product_available: 1 | 0;
}
export interface LoadSeasonsProps {
    id?: number;
    code?: string;
}
export declare function loadSeasons({ id, code }: LoadSeasonsProps): Promise<ProductSeason[]>;
export declare function saveSeason({ product_season_id, code, description, product_available, product_teaser, active }: ProductSeason): Promise<ProductSeason[]>;
export declare function getSeasons(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postSeason(req: any, res: any): Promise<any>;
