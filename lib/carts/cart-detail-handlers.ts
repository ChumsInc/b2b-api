import Debug from 'debug';
import {loadItemPricing, loadItemUnitOfMeasure, parseCustomerKey, parseCustomerPrice} from "./cart-utils.js";
import {createNewCart, updateCartTotals} from "./cart-header-handlers.js";
import {loadCart} from "./load-cart.js";
import {Decimal} from "decimal.js";
import {mysql2Pool} from "chums-local-modules";
import type {
    AddToCartBody,
    AddToCartProps,
    AddToNewCartProps,
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
export async function addToCart(props: AddToCartProps): Promise<B2BCart | null>;
export async function addToCart(props: AddToNewCartProps): Promise<B2BCart | null>;
export async function addToCart({
                                    userId,
                                    cartId,
                                    customerKey,
                                    customerPONo,
                                    shipToCode,
                                    ...itemProps
                                }: AddToCartProps | AddToNewCartProps): Promise<B2BCart | null> {
    try {
        const customer = await parseCustomerKey(customerKey);
        if (customer.shipToCode) {
            shipToCode = customer.shipToCode;
        }
        let cart: B2BCart | null;
        if (!cartId) {
            cart = await createNewCart({customerKey, userId, shipToCode, customerPONo});
        } else {
            cart = await loadCart({cartId, userId});
        }

        if (!cart) {
            return Promise.reject(new Error('Error retrieving cart'));
        }
        await addItemsToCart(cart, [itemProps]);
        cartId = cart.header.id;
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

export async function addItemsToCart(cart: B2BCart, items: AddToCartBody[], allowZeroPrice?: boolean): Promise<void> {
    try {
        const {arDivisionNo, customerNo} = cart.header
        for await (const item of items) {
            let itemPricing: B2BCartItemPrice | null = null;
            let unitPrice: string | number | null = null;
            let uom: UnitOfMeasureLookup | null = null;

            if (item.itemType !== '4') {
                if (!item.quantityOrdered || Number.isNaN(item.quantityOrdered)) {
                    continue;
                }

                itemPricing = await loadItemPricing({
                    arDivisionNo,
                    customerNo,
                    itemCode: item.itemCode,
                    priceLevel: item.priceLevel
                });
                if (!itemPricing) {
                    item.commentText = `Item '${item.itemCode}'; Error: Item is either discontinued or inactive; Original Quantity: ${+item.quantityOrdered}`;
                    item.itemType = '4';
                    item.itemCode = '/C'
                    item.quantityOrdered = 0;
                }

                uom = await loadItemUnitOfMeasure(item.itemCode, item.unitOfMeasure)
                unitPrice = parseCustomerPrice(itemPricing, uom);
                if (item.itemType !== '4'
                    && !allowZeroPrice
                    && new Decimal(itemPricing?.StandardUnitPrice ?? 0).gt(0)
                    && new Decimal(unitPrice ?? 0).eq(0)
                ) {
                    item.commentText = `Item '${item.itemCode}'; Error: Invalid item pricing, see customer service for help; Original Quantity: ${+item.quantityOrdered}`;
                    item.itemType = '4';
                    item.itemCode = '/C'
                    item.quantityOrdered = 0;
                    if (itemPricing) {
                        itemPricing.ItemType = '4';
                        itemPricing.CustomerPriceLevel = null;
                    }
                }

            }
            const sql = `INSERT INTO b2b.cart_detail (cartHeaderId, productId, productItemId, salesOrderNo, lineKey,
                                                      itemCode, itemType, priceLevel, commentText,
                                                      unitOfMeasure, unitOfMeasureConvFactor, quantityOrdered,
                                                      unitPrice, extensionAmt, lineStatus)
                         VALUES (:cartId, :productId, :productItemId, :salesOrderNo, NULL,
                                 :itemCode, :itemType, :priceLevel, :commentText,
                                 :unitOfMeasure, :unitOfMeasureConvFactor, :quantityOrdered,
                                 :unitPrice, :extensionAmt, 'N')`
            const args = {
                cartId: cart.header.id,
                productId: item.productId,
                productItemId: item.productItemId,
                salesOrderNo: cart.header.salesOrderNo,
                itemCode: item.itemCode,
                itemType: itemPricing?.ItemType ?? item.itemType ?? null,
                priceLevel: itemPricing?.CustomerPriceLevel ?? null,
                commentText: item.commentText,
                unitOfMeasure: item.unitOfMeasure ?? uom?.unitOfMeasure ?? 'EA',
                unitOfMeasureConvFactor: uom?.unitOfMeasureConvFactor ?? 1,
                quantityOrdered: item.quantityOrdered ?? 0,
                unitPrice: unitPrice ?? 0,
                extensionAmt: new Decimal(item.quantityOrdered ?? 0).times(unitPrice ?? 0).toString()
            };
            await mysql2Pool.query(sql, args);
        }
        await updateCartTotals(cart.header.id);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("addItemsToCart()", err.message);
            return Promise.reject(err);
        }
        debug("addItemsToCart()", err);
        return Promise.reject(new Error('Error in addItemsToCart()'));
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
        const item = await loadCartItem({userId, cartId, cartItemId});
        const sql = `UPDATE b2b.cart_detail
                     SET lineStatus      = :lineStatus,
                         quantityOrdered = 0,
                         extensionAmt    = 0
                     WHERE cartHeaderId = :cartId
                       AND id = :cartItemId`
        const args = {cartId, cartItemId, lineStatus: item.soDetail?.lineKey ? 'U' : 'X'};
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

