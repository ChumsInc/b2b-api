import Debug from "debug";
import {NextFunction, Request, Response} from "express";
import {addToCart, removeCartItem, updateCartItem} from "./cart-detail-handlers.js";
import {cancelCartHeader, updateCartHeader} from "./cart-header-handlers.js";
import {loadCart, loadCarts} from "./load-cart.js";
import type {AddToCartBody, UpdateCartHeaderBody, UpdateCartItemBody} from "./types/cart-action-props.d.ts";
import {getUserId} from "./utils.js";
import {syncFromC2} from "./sync-cart.js";

const debug = Debug('chums:lib:carts:cart-methods');

export async function getCart(req: Request, res: Response): Promise<void> {
    try {
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        await syncFromC2({cartId});
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

export async function getCarts(req: Request, res: Response) {
    try {
        let customerKey = req.params.customerKey;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        await syncFromC2({customerKey});
        const carts = await loadCarts({customerKey, userId});
        res.json({carts})
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.debug("getCarts()", err.message);
            return Promise.reject(err);
        }
        console.debug("getCarts()", err);
        return Promise.reject(new Error('Error in getCarts()'));
    }
}


export const putUpdateCart = async (req: Request, res: Response, next: NextFunction):Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId} = req.params;
        const body:UpdateCartHeaderBody = {
            shipToCode: req.body.shipToCode ?? undefined,
            customerPONo: req.body.customerPONo ?? undefined,
            promoCode: req.body.promoCode ?? undefined,
            comment: req.body.comment ?? undefined,
        };
        const cart = await updateCartHeader({userId, customerKey, cartId, ...body});
        res.json({cart});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("putUpdateCart()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in putUpdateCart'});
    }
}

export const deleteCart = async (req: Request, res: Response):Promise<void> => {
    try {
        const userId = res.locals.profile!.user.id;
        const {customerKey, cartId} = req.params;
        await cancelCartHeader({userId, customerKey, cartId});
        const carts = await loadCarts({userId, customerKey});
        res.json({carts});
    } catch(err:unknown) {
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
            unitOfMeasure: req.body.unitOfMeasure,
            quantityOrdered: req.body.quantityOrdered,
            commentText: req.body.commentText ?? '',
        }
        const cart = await addToCart({userId, cartId, customerKey, ...body});
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
        const body: UpdateCartItemBody = {
            quantityOrdered: req.body.quantityOrdered,
            commentText: req.body.commentText ?? null,
        }
        const cart = await updateCartItem({userId, cartId, cartItemId, customerKey, ...body});
        res.json({cart});

    } catch(err:unknown) {
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
        const cart = await removeCartItem({userId, customerKey, cartId, cartItemId});
        res.json({cart});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("deleteCartItem()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in deleteCartItem'});
    }
}
