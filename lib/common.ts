import {validateRole} from "chums-local-modules";
import Debug from "debug";
import {NextFunction, Request, Response} from "express";

const debug = Debug('chums:lib:common');

export const validateAdmin = validateRole(['webadmin', 'admin', 'product-admin']);

export const deprecationNotice = (req: Request, res: Response, next: NextFunction) => {
    debug(req.method, req.originalUrl, '<<< DEPRECATED', req.headers.referer, req.headers['user-agent']);
    next();
}

