import {Router} from 'express';
import {validateRole, validateUser} from "chums-local-modules";
import {
    deleteCart,
    deleteCartItem,
    getCart,
    getCartsList,
    getCustomerCarts,
    postAddToCart, postDuplicateSalesOrder,
    putUpdateCart,
    putUpdateCartItem,
    putUpdateCartItems
} from "./cart-methods.js";
import {postSyncCarts, postSyncSage} from "./sync-cart.js";
import {getCartEmailHTML, getCartEmailJSON, getCartEmailText, sendCartEmail} from "./cart-mailer.js";

const cartsRouter = Router();
cartsRouter.use(validateUser);

cartsRouter.post('/sync.json', validateRole(['cs', 'sales', 'web_admin']), postSyncCarts);
cartsRouter.get('/sync.json', validateRole(['cs', 'sales', 'web_admin']), postSyncCarts);
cartsRouter.post('/sync/:salesOrderNo.json', validateRole(['cs', 'sales', 'web_admin']), postSyncSage);

cartsRouter.get('/list.json', validateRole(['cs', 'sales', 'web_admin']), getCartsList);

cartsRouter.get('/:customerKey.json', getCustomerCarts);
cartsRouter.get('/:customerKey/:cartId.json', getCart);
cartsRouter.put('/:customerKey/:cartId.json', putUpdateCart);
cartsRouter.delete('/:customerKey/:cartId.json', deleteCart);
cartsRouter.post('/:customerKey/duplicate/:salesOrderNo.json', postDuplicateSalesOrder);
cartsRouter.post('/:customerKey/new/cart.json', postAddToCart);
cartsRouter.post('/:customerKey/:cartId/cart.json', postAddToCart);
cartsRouter.get('/:customerKey/:cartId/email.html', getCartEmailHTML);
cartsRouter.get('/:customerKey/:cartId/email.json', getCartEmailJSON);
cartsRouter.get('/:customerKey/:cartId/email.txt', getCartEmailText);
cartsRouter.post('/:customerKey/:cartId/email.json', sendCartEmail);
cartsRouter.put('/:customerKey/:cartId/items.json', putUpdateCartItems);
cartsRouter.put('/:customerKey/:cartId/:cartItemId.json', putUpdateCartItem);
cartsRouter.delete('/:customerKey/:cartId/:cartItemId.json', deleteCartItem);

export default cartsRouter;
