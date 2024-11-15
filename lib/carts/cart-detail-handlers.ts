import Debug from 'debug';
import {loadItemPricing, loadItemUnitOfMeasure, parseCustomerKey, parseCustomerPrice} from "./cart-utils.js";
import {createNewCart} from "./cart-header-handlers.js";
import {loadCart} from "./load-cart.js";
import Decimal from "decimal.js";
import {mysql2Pool} from "chums-local-modules";
import type {
    AddToCartProps,
    CartItemActionProps,
    LoadCartItemProps,
    UpdateCartItemProps
} from "./types/cart-action-props.d.ts";
import type {B2BCart} from "./types/cart.d.ts";
import type {B2BCartDetail} from "./types/cart-detail.d.ts";

const debug = Debug('chums:lib:carts:cart-detail-handlers');


/**
 * Add an item to the cart, price is calculated based on Customer, Item, or Price Code pricing.
 *
 * <em>priceLevel value can be used to override the default customer price level from AR_Customer</em>
 */
export async function addToCart({
                                    userId,
                                    cartId,
                                    customerKey,
                                    productId,
                                    productItemId,
                                    itemCode,
                                    unitOfMeasure,
                                    quantityOrdered,
                                    commentText,
                                    priceLevel,
                                }: AddToCartProps): Promise<B2BCart | null> {
    try {
        const {arDivisionNo, customerNo, shipToCode} = await parseCustomerKey(customerKey);
        let cart: B2BCart | null = null;
        if (!quantityOrdered || Number.isNaN(quantityOrdered)) {
            return Promise.reject(new Error('Invalid quantity to add to cart'))
        }

        const itemPricing = await loadItemPricing({arDivisionNo, customerNo, itemCode, priceLevel});
        if (!itemPricing) {
            return Promise.reject(new Error("Item is either discontinued or inactive"));
        }

        const unitPrice = parseCustomerPrice(itemPricing);
        if (itemPricing.ItemType !== '4' && !unitPrice) {
            return Promise.reject(new Error('Invalid item pricing, see customer service for help.'));
        }

        const uom = await loadItemUnitOfMeasure(itemCode, unitOfMeasure)

        if (!cartId) {
            cart = await createNewCart({customerKey, userId, shipToCode});
        } else {
            cart = await loadCart({cartId, userId});
        }

        if (!cart) {
            return Promise.reject(new Error('Error retrieving cart'));
        }


        cartId = cart.header.id;
        const sql = `INSERT INTO b2b.cart_detail (cartHeaderId, productId, productItemId, salesOrderNo, lineKey,
                                                  itemCode, itemType, priceLevel, commentText,
                                                  unitOfMeasure, unitOfMeasureConvFactor, quantityOrdered,
                                                  unitPrice, extensionAmt, lineStatus)
                     VALUES (:cartId, :productId, :productItemId, :salesOrderNo, NULL,
                             :itemCode, :itemType, :priceLevel, :commentText,
                             :unitOfMeasure, :unitOfMeasureConvFactor, :quantityOrdered,
                             :unitPrice, :extensionAmt, '_')`
        const args = {
            cartId,
            productId,
            productItemId,
            salesOrderNo: cart.header.salesOrderNo,
            itemCode: itemCode,
            itemType: itemPricing.ItemType,
            priceLevel: itemPricing.CustomerPriceLevel,
            commentText,
            unitOfMeasure: unitOfMeasure ?? uom?.unitOfMeasure ?? 'EA',
            unitOfMeasureConvFactor: uom?.unitOfMeasureConvFactor,
            quantityOrdered,
            unitPrice: unitPrice,
            extensionAmt: new Decimal(quantityOrdered).times(unitPrice ?? 0).toString()
        };
        await mysql2Pool.query(sql, args);
        return await loadCart({cartId, userId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("addToCart()", err.message);
            return Promise.reject(err);
        }
        debug("addToCart()", err);
        return Promise.reject(new Error('Error in addToCart()'));
    }
}

export async function updateCartItem({
                                         userId,
                                         cartId,
                                         cartItemId,
                                         customerKey,
                                         quantityOrdered,
                                         commentText
                                     }: UpdateCartItemProps): Promise<B2BCart | null> {
    try {
        const {arDivisionNo, customerNo} = await parseCustomerKey(customerKey);
        const item = await loadCartItem({userId, cartId, cartItemId});
        if (!quantityOrdered || Number.isNaN(quantityOrdered)) {
            return Promise.reject(new Error('Invalid quantity to update to cart'))
        }

        const itemPricing = await loadItemPricing({
            arDivisionNo,
            customerNo,
            itemCode: item.itemCode,
            priceLevel: item.pricing.priceLevel
        });
        if (!itemPricing) {
            return Promise.reject(new Error("Item is either discontinued or inactive"));
        }

        const unitPrice = parseCustomerPrice(itemPricing);
        if (!unitPrice) {
            return Promise.reject(new Error('Invalid item pricing, see customer service for help.'));
        }

        const sql = `UPDATE b2b.cart_detail
                     SET quantityOrdered = :quanitityOrdered,
                         unitPrice       = :unitPrice,
                         extensionAmt    = :extensionAmt,
                         commentText     = :commentText
                     WHERE cartHeaderId = :cartId
                       AND id = :cartItemId`;
        const args = {
            cartId,
            cartItemId,
            quantityOrdered: quantityOrdered,
            unitPrice: unitPrice,
            extensionAmt: new Decimal(quantityOrdered).times(unitPrice).toString(),
            commentText: commentText ?? item.commentText,
        }
        await mysql2Pool.query(sql, args);
        return await loadCart({cartId, userId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("updateCartItem()", err.message);
            return Promise.reject(err);
        }
        debug("updateCartItem()", err);
        return Promise.reject(new Error('Error in updateCartItem()'));
    }
}


export async function removeCartItem({userId, cartId, cartItemId}: CartItemActionProps): Promise<B2BCart | null> {
    try {
        await loadCartItem({userId, cartId, cartItemId});
        const sql = `DELETE
                     FROM b2b.cart_detail
                     WHERE cartHeaderId = :cartId
                       AND id = :cartItemId`
        const args = {cartId, cartItemId};
        await mysql2Pool.query(sql, args);
        return await loadCart({cartId, userId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("deleteCartItem()", err.message);
            return Promise.reject(err);
        }
        debug("deleteCartItem()", err);
        return Promise.reject(new Error('Error in deleteCartItem()'));
    }
}

async function loadCartItem({userId, cartId, cartItemId}: LoadCartItemProps): Promise<B2BCartDetail> {
    try {
        const cart = await loadCart({userId, cartId});
        if (!cart) {
            return Promise.reject(new Error('Error retrieving cart'));
        }
        const [item] = cart.detail.filter(item => item.id.toString() === (cartItemId ?? 0).toString());
        if (!item) {
            return Promise.reject(new Error('Cart item is not found'));
        }
        return item;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCartItem()", err.message);
            return Promise.reject(err);
        }
        debug("loadCartItem()", err);
        return Promise.reject(new Error('Error in loadCartItem()'));
    }
}
