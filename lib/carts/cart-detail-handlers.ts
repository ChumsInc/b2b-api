import Debug from 'debug';
import {loadItemPricing, loadItemUnitOfMeasure, parseCustomerKey, parseCustomerPrice} from "./cart-utils.js";
import {createNewCart, updateCartTotals} from "./cart-header-handlers.js";
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
import {B2BCartItemPrice, UnitOfMeasureLookup} from "./types/cart-utils.js";

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
                                    itemType,
                                    unitOfMeasure,
                                    quantityOrdered,
                                    commentText,
                                    priceLevel,
                                }: AddToCartProps): Promise<B2BCart | null> {
    try {
        const {arDivisionNo, customerNo, shipToCode} = await parseCustomerKey(customerKey);
        let cart: B2BCart | null = null;
        let itemPricing: B2BCartItemPrice | null = null;
        let unitPrice: string | number | null = null;
        let uom: UnitOfMeasureLookup | null = null;

        if (itemType !== '4') {
            if (!quantityOrdered || Number.isNaN(quantityOrdered)) {
                return Promise.reject(new Error('Invalid quantity to add to cart'))
            }

            itemPricing = await loadItemPricing({arDivisionNo, customerNo, itemCode, priceLevel});
            if (!itemPricing) {
                return Promise.reject(new Error("Item is either discontinued or inactive"));
            }

            uom = await loadItemUnitOfMeasure(itemCode, unitOfMeasure)
            unitPrice = parseCustomerPrice(itemPricing, uom);
            if (!unitPrice) {
                return Promise.reject(new Error('Invalid item pricing, see customer service for help.'));
            }

        }

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
                             :unitPrice, :extensionAmt, 'N')`
        const args = {
            cartId,
            productId,
            productItemId,
            salesOrderNo: cart.header.salesOrderNo,
            itemCode: itemCode,
            itemType: itemPricing?.ItemType ?? itemType ?? null,
            priceLevel: itemPricing?.CustomerPriceLevel ?? null,
            commentText,
            unitOfMeasure: unitOfMeasure ?? uom?.unitOfMeasure ?? 'EA',
            unitOfMeasureConvFactor: uom?.unitOfMeasureConvFactor ?? 1,
            quantityOrdered: quantityOrdered ?? 0,
            unitPrice: unitPrice,
            extensionAmt: new Decimal(quantityOrdered ?? 0).times(unitPrice ?? 0).toString()
        };
        debug('addToCart()', args);
        await mysql2Pool.query(sql, args);
        await updateCartTotals(cartId);
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
                                     }: UpdateCartItemProps): Promise<void | null> {
    try {
        const {arDivisionNo, customerNo} = await parseCustomerKey(customerKey);
        const item = await loadCartItem({userId, cartId, cartItemId});
        let itemPricing: B2BCartItemPrice | null = null;
        let unitPrice: number | string | null = null;
        if (item.itemType !== '4') {
            if (!quantityOrdered || Number.isNaN(quantityOrdered)) {
                return Promise.reject(new Error('Invalid quantity to update to cart'))
            }

            itemPricing = await loadItemPricing({
                arDivisionNo,
                customerNo,
                itemCode: item.itemCode,
                priceLevel: item.pricing.priceLevel
            });
            if (!itemPricing) {
                return Promise.reject(new Error("Item is either discontinued or inactive"));
            }
            const uom: UnitOfMeasureLookup = {
                unitOfMeasure: item.unitOfMeasure,
                unitOfMeasureConvFactor: item.unitOfMeasureConvFactor
            };
            unitPrice = parseCustomerPrice(itemPricing, uom);
            if (!unitPrice) {
                return Promise.reject(new Error('Invalid item pricing, see customer service for help.'));
            }
        }

        const sql = `UPDATE b2b.cart_detail
                     SET quantityOrdered = :quantityOrdered,
                         unitPrice       = :unitPrice,
                         extensionAmt    = :extensionAmt,
                         commentText     = :commentText,
                         lineStatus      = 'U'
                     WHERE cartHeaderId = :cartId
                       AND id = :cartItemId`;
        const args = {
            cartId,
            cartItemId,
            quantityOrdered: quantityOrdered,
            unitPrice: unitPrice ?? 0,
            extensionAmt: new Decimal(quantityOrdered).times(unitPrice ?? 0).toString(),
            commentText: commentText ?? item.commentText,
        }
        await mysql2Pool.query(sql, args);
        await updateCartTotals(cartId);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("updateCartItem()", err.message);
            return Promise.reject(err);
        }
        debug("updateCartItem()", err);
        return Promise.reject(new Error('Error in updateCartItem()'));
    }
}


export async function removeCartItem({userId, cartId, cartItemId}: CartItemActionProps): Promise<void> {
    try {
        await loadCartItem({userId, cartId, cartItemId});
        const sql = `UPDATE b2b.cart_detail
                     SET lineStatus = 'X',
                         quantityOrdered = 0,
                         extensionAmt = 0
                     WHERE cartHeaderId = :cartId
                       AND id = :cartItemId`
        const args = {cartId, cartItemId};
        await mysql2Pool.query(sql, args);
        await updateCartTotals(cartId);
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

