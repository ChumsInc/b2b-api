import Debug from 'debug';
import {Request, Response} from 'express'
import {getUserValidation} from 'chums-local-modules';
import {syncFromC2} from "./sync-cart.js";
import {loadCart, loadCarts} from "./load-cart.js";
import {getUserId} from "./utils.js";

const debug = Debug('chums:lib:carts:get-cart');


export async function getCart(req: Request, res: Response):Promise<void> {
    try {
        const id = req.params.id;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        await syncFromC2({id});
        const cart = await loadCart({id, userId});
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

