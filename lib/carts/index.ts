import {Router} from 'express';
import {validateUser} from "chums-local-modules";
import {getCart, getCarts} from "./get-cart.js";
import {postSyncCarts, postSyncSage} from "./sync-cart.js";

const cartsRouter = Router();
cartsRouter.use((req, res, next) => {
    res.locals.debug = true;
    next();
}, validateUser);

cartsRouter.post('/sync.json', postSyncCarts);
cartsRouter.get('/sync.json', postSyncCarts);
cartsRouter.post('/sync/:salesOrderNo.json', postSyncSage);

cartsRouter.get('/list.json', getCarts);
cartsRouter.get('/:customerKey/:id(\\d+).json', getCart)
cartsRouter.get('/:customerKey.json', getCarts);


export default cartsRouter;
