import {Router} from 'express';
import {validateRole, validateUser} from "chums-local-modules";
import {
    deleteCart,
    deleteCartItem,
    getCart,
    getCarts,
    postAddToCart,
    putUpdateCart,
    putUpdateCartItem
} from "./cart-methods.js";
import {postSyncCarts, postSyncSage} from "./sync-cart.js";

const cartsRouter = Router();
cartsRouter.use(validateUser);

cartsRouter.post('/sync.json', validateRole(['cs', 'sales', 'web_admin']), postSyncCarts);
cartsRouter.get('/sync.json', validateRole(['cs', 'sales', 'web_admin']), postSyncCarts);
cartsRouter.post('/sync/:salesOrderNo.json', validateRole(['cs', 'sales', 'web_admin']), postSyncSage);

cartsRouter.get('/list.json', validateRole(['cs', 'sales', 'web_admin']), getCarts);
cartsRouter.get('/:customerKey.json', getCarts);
cartsRouter.get('/:customerKey/:cartId.json', getCart);
cartsRouter.put('/:customerKey/:cartId.json', putUpdateCart);
cartsRouter.delete('/:customerKey/:cartId.json', deleteCart);
cartsRouter.post('/:customerKey/new/cart.json', postAddToCart);
cartsRouter.post('/:customerKey/:cartId/cart.json', postAddToCart);
cartsRouter.put('/:customerKey/:cartId/:cartItemId.json', putUpdateCartItem);
cartsRouter.delete('/:customerKey/:cartId/:cartItemId.json', deleteCartItem);

export default cartsRouter;
