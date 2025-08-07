import { validateRole } from "chums-local-modules";
import Debug from "debug";
const debug = Debug('chums:lib:common');
export const validateAdmin = validateRole(['webadmin', 'admin', 'product-admin']);
export const deprecationNotice = (req, res, next) => {
    debug(req.method, req.originalUrl, '<<< DEPRECATED', req.headers.referer, req.headers['user-agent']);
    next();
};
