import { Request, Response } from "express";
export declare function getColors(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getMixItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function postColor(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
