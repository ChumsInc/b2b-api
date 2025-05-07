import Debug from "debug";
import {NextFunction, Request, Response} from "express";
import {addToCart, removeCartItem, updateCartItem} from "./cart-detail-handlers.js";
import {cancelCartHeader, updateCartHeader, updateCartPrinted, updateCartTotals} from "./cart-header-handlers.js";
import {loadCart, loadCartHeader, loadCartOrder, loadCustomerCarts} from "./load-cart.js";
import type {AddToCartBody, UpdateCartHeaderBody, UpdateCartItemBody} from "./types/cart-action-props.d.ts";
import {getUserId, isUpdateCartItemBody, isUpdateCartItemsBody} from "./utils.js";
import {syncFromC2} from "./sync-cart.js";
import {B2BCart} from "./types/cart.js";
import {duplicateSalesOrder} from "./duplicate-sales-order.js";

const debug = Debug('chums:lib:carts:cart-methods');

export async function getCart(req: Request, res: Response): Promise<void> {
    try {
        const customerKey = req.params.customerKey;
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        await syncFromC2({customerKey, cartId});
        await updateCartTotals(cartId);
        const cart = await loadCart({cartId, userId});
        if (!cart) {
            res.status(404).json({error: 'Cart not found'});
            return;
        }
        res.json({cart});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCart'});
    }
}

export async function getCartOrder(req: Request, res: Response): Promise<void> {
    try {
        const customerKey = req.params.customerKey;
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        await syncFromC2({customerKey, cartId});
        const cartOrder = await loadCartOrder({cartId, userId});
        if (!cartOrder) {
            res.status(404).json({error: 'Cart not found'});
            return;
        }
        res.json({cartOrder});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCart'});
    }
}

export async function postCartPrinted(req: Request, res: Response): Promise<void> {
    try {
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        const cartOrder = await updateCartPrinted(cartId, userId, true);
        res.json({cartOrder});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("postCartPrinted()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postCartPrinted'});
    }
}

export async function deleteCartPrinted(req: Request, res: Response): Promise<void> {
    try {
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        const cartOrder = await updateCartPrinted(cartId, userId, false);
        res.json({cartOrder});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("postCartPrinted()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postCartPrinted'});
    }
}

export async function getCartsList(req: Request, res: Response) {
    try {
        let customerKey = req.params.customerKey;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        if (customerKey) {
            await syncFromC2({customerKey});
        }
        const carts = await loadCartHeader({customerKey, userId}, 'C');
        res.json({carts})
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCartsList()", err.message);
            return Promise.reject(err);
        }
        debug("getCartsList()", err);
        return Promise.reject(new Error('Error in getCartsList()'));
    }
}

export async function getOrdersList(req: Request, res: Response) {
    try {
        let customerKey = req.params.customerKey;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        if (customerKey) {
            await syncFromC2({customerKey});
        }
        const orders = await loadCartHeader({customerKey, userId}, 'O');
        res.json({orders})
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCartsList()", err.message);
            return Promise.reject(err);
        }
        debug("getCartsList()", err);
        return Promise.reject(new Error('Error in getCartsList()'));
    }
}

export async function getCustomerCarts(req: Request, res: Response) {
    try {
        const customerKey = req.params.customerKey;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        await syncFromC2({customerKey});
        const carts = await loadCustomerCarts({userId, customerKey});
        res.json({carts})
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCustomerCarts()", err.message);
            return Promise.reject(err);
        }
        debug("getCustomerCarts()", err);
        return Promise.reject(new Error('Error in getCustomerCarts()'));
    }
}


export const putUpdateCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId} = req.params;
        const body: UpdateCartHeaderBody = {
            shipToCode: req.body.shipToCode ?? undefined,
            customerPONo: req.body.customerPONo ?? undefined,
            promoCode: req.body.promoCode ?? undefined,
            comment: req.body.comment ?? undefined,
        };
        await updateCartHeader({userId, customerKey, cartId, ...body});
        const cart = await loadCart({userId, cartId});
        res.json({cart});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("putUpdateCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in putUpdateCart'});
    }
}

export const deleteCart = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId} = req.params;
        await cancelCartHeader({userId, customerKey, cartId});
        const carts = await loadCartHeader({userId, customerKey}, 'C');
        res.json({carts});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("deleteCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in deleteCart'});
    }
}


export const postAddToCart = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId} = req.params;
        const body: AddToCartBody = {
            productId: req.body.productId ?? null,
            productItemId: req.body.productItemId ?? null,
            itemCode: req.body.itemCode,
            itemType: req.body.itemType ?? '1',
            unitOfMeasure: req.body.unitOfMeasure,
            quantityOrdered: req.body.quantityOrdered,
            commentText: req.body.commentText ?? '',
        }
        let cart: B2BCart | null;
        if (!cartId) {
            cart = await addToCart({
                userId,
                cartId: null,
                customerKey,
                ...body,
                customerPONo: req.body.customerPONo ?? '',
                shipToCode: req.body.shipToCode ?? undefined,
            });
        } else {
            cart = await addToCart({userId, cartId, customerKey, ...body});
        }
        res.json({cart});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("addToCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in addToCart'});
    }
}

export const putUpdateCartItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId, cartItemId} = req.params;
        if (isUpdateCartItemBody(req.body)) {
            const body: UpdateCartItemBody = {
                quantityOrdered: req.body.quantityOrdered,
                commentText: req.body.commentText ?? null,
            }
            await updateCartItem({userId, cartId, cartItemId, customerKey, ...body});
        }
        const cart = await loadCart({cartId, userId});
        res.json({cart});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("putUpdateCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in putUpdateCart'});
    }
}

export const putUpdateCartItems = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId} = req.params;
        if (isUpdateCartItemsBody(req.body)) {
            for await (const item of req.body.items) {
                if (isUpdateCartItemBody(item)) {
                    if (item.itemType !== '4' && item.quantityOrdered === 0) {
                        // remove item line
                        await removeCartItem({userId, cartId, cartItemId: item.id, customerKey});
                    } else if (item.itemType === '4' && item.commentText.trim() === '') {
                        // remove comment line
                        await removeCartItem({userId, cartId, cartItemId: item.id, customerKey});
                    } else {
                        await updateCartItem({userId, cartId, cartItemId: item.id, customerKey, ...item});
                    }
                } else {
                    debug('putUpdateCartItems() is not a cart item?', item, isUpdateCartItemBody(item));
                }
            }
            await updateCartTotals(cartId);
        } else {
            debug('putUpdateCartItems()', isUpdateCartItemsBody(req.body), req.body);
        }
        const cart = await loadCart({cartId, userId});
        res.json({cart});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("putUpdateCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in putUpdateCart'});
    }
}

export const deleteCartItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId, cartItemId} = req.params;
        await removeCartItem({userId, customerKey, cartId, cartItemId});
        const cart = await loadCart({cartId, userId});
        res.json({cart});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("deleteCartItem()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in deleteCartItem'});
    }
}

export const postDuplicateSalesOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, salesOrderNo} = req.params;
        const cartName = req.body.cartName ?? null;
        const shipToCode = req.body.shipToCode ?? null;
        const allowZeroPrice = [1, 2].includes(res.locals.profile?.user.accountType ?? 0);
        const cart = await duplicateSalesOrder({
            userId,
            customerKey,
            salesOrderNo,
            cartName,
            shipToCode,
            allowZeroPrice
        });
        res.json({cart});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("duplicateSalesOrder()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in duplicateSalesOrder'});
    }
}
