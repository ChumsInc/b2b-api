import Debug from 'debug';
import {loadCart} from "./load-cart.js";
import {mysql2Pool} from "chums-local-modules";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {parseCustomerKey} from "./cart-utils.js";
import type {CartActionProps, UpdateCartProps} from "./types/cart-action-props.d.ts";
import type {B2BCart} from "./types/cart.d.ts";
import {Decimal} from "decimal.js";

const debug = Debug('chums:lib:carts:cart-header-handlers');

export async function createNewCart({
                                        userId,
                                        customerKey,
                                        shipToCode,
                                        customerPONo,
                                    }: Omit<CartActionProps, 'cartId'>): Promise<B2BCart | null> {
    try {
        const {arDivisionNo, customerNo} = await parseCustomerKey(customerKey);
        const sql = `INSERT INTO b2b.cart_header (orderType, orderStatus, arDivisionNo, customerNo, shipToCode,
                                                  salespersonDivisionNo, salespersonNo, taxSchedule,
                                                  customerPONo, shipExpireDate, shipVia, promoCode, comment,
                                                  subTotalAmt, createdByUserId, updatedByUseId)
                     SELECT 'Q'                                                       AS orderType,
                            'N'                                                       AS orderStatus,
                            c.ARDivisionNo                                            AS arDivisionNo,
                            c.CustomerNo                                              AS customerNo,
                            st.ShipToCode                                             AS shipToCode,
                            IFNULL(st.SalespersonDivisionNo, c.SalespersonDivisionNo) AS salespersonDivisionNo,
                            IFNULL(st.SalespersonNo, c.SalespersonNo)                 AS salespersonNo,
                            c.TaxSchedule                                             AS taxSchedule,
                            :customerPONo                                             AS customerPONo,
                            DATE_ADD(NOW(), INTERVAL 12 MONTH)                        AS shipExpireDate,
                            c.ShipMethod                                              AS shipVia,
                            NULL                                                      AS promoCode,
                            NULL                                                      AS comment,
                            0                                                         AS subTotalAmt,
                            :userId                                                   AS createdByUserId,
                            :userId                                                   AS updatedByUserId
                     FROM c2.ar_customer c
                              LEFT JOIN c2.SO_ShipToAddress st ON st.Company = c.Company AND
                                                                  st.ARDivisionNo = c.ARDivisionNo AND
                                                                  st.CustomerNo = c.CustomerNo AND
                                                                  st.ShipToCode = :shipToCode
                     WHERE c.Company = 'chums'
                       AND c.ARDivisionNo = :arDivisionNo
                       AND c.CustomerNo = :customerNo`;
        const args = {arDivisionNo, customerNo, shipToCode, userId, customerPONo}
        const [result] = await mysql2Pool.query<ResultSetHeader>(sql, args);
        return await loadCart({cartId: result.insertId, userId})
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("createNewCart()", err.message);
            return Promise.reject(err);
        }
        debug("createNewCart()", err);
        return Promise.reject(new Error('Error in createNewCart()'));
    }
}


export async function updateCartHeader({userId, cartId, ...props}: UpdateCartProps): Promise<void> {
    try {
        const cart = await loadCart({cartId, userId});
        if (!cart || !cart.header) {
            return Promise.reject(new Error('Cart is not found'));
        }
        if (!['_', 'Q'].includes(cart.header.orderType)) {
            return Promise.reject(new Error('Cart has already been promoted to an order'));
        }
        const sql = `UPDATE b2b.cart_header
                     SET shipToCode     = :shipToCode,
                         promoCode      = :promoCode,
                         customerPONo   = :customerPONo,
                         comment        = :comment,
                         updatedByUseId = :userId
                     WHERE id = :cartId`
        const data = {
            cartId,
            shipToCode: props.shipToCode ?? cart.header.shipToCode,
            promoCode: props.promoCode ?? cart.header.promoCode,
            customerPONo: props.customerPONo ?? cart.header.customerPONo,
            comment: props.comment ?? cart.header.comment,
            userId
        }
        await mysql2Pool.query(sql, data);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("updateCartHeader()", err.message);
            return Promise.reject(err);
        }
        debug("updateCartHeader()", err);
        return Promise.reject(new Error('Error in updateCartHeader()'));
    }
}


export async function cancelCartHeader({cartId, userId}: CartActionProps): Promise<void> {
    try {
        const cart = await loadCart({cartId, userId});
        if (!cart || !cart.header) {
            return Promise.reject(new Error('Cart is not found'));
        }
        if (!['_', 'Q'].includes(cart.header.orderType)) {
            return Promise.reject(new Error('Cart has already been promoted to an order.'));
        }
        const sql = `UPDATE b2b.cart_header
                     SET orderStatus    = 'Z',
                         updatedByUseId = :userId
                     WHERE id = :cartId`;
        const data = {userId, cartId};
        await mysql2Pool.query(sql, data);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("cancelCartHeader()", err.message);
            return Promise.reject(err);
        }
        debug("cancelCartHeader()", err);
        return Promise.reject(new Error('Error in cancelCartHeader()'));
    }
}

export async function updateCartTotals(cartId: number | string): Promise<void> {
    try {
        interface DetailAmountRow extends RowDataPacket {
            taxClass: string;
            amount: string | number;
        }

        const sqlDetail = `SELECT taxClass,
                                  SUM(quantityOrdered * unitPrice *
                                      (1 + (IFNULL(lineDiscountPercent, 0) / 100))) AS amount
                           FROM b2b.cart_detail
                           WHERE cartHeaderId = :cartId
                             AND lineStatus <> 'X'
                             AND itemType <> '4'
                           GROUP BY taxClass`
        const [detail] = await mysql2Pool.query<DetailAmountRow[]>(sqlDetail, {cartId});
        const [taxable] = detail.filter(row => row.taxClass === 'TX');
        const [nontaxable] = detail.filter(row => row.taxClass !== 'TX');
        const args = {
            cartId,
            taxableAmt: taxable?.amount ?? 0,
            nonTaxableAmt: nontaxable?.amount ?? 0,
            subTotalAmt: new Decimal(taxable?.amount ?? 0).add(nontaxable?.amount ?? 0).toString()
        }
        const sql = `UPDATE b2b.cart_header h
                     SET taxableAmt    = :taxableAmt,
                         nonTaxableAmt = :nonTaxableAmt,
                         subTotalAmt   = :subTotalAmt
                     WHERE id = :cartId`;
        await mysql2Pool.query(sql, args);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("updateCartTotals()", err.message);
            return Promise.reject(err);
        }
        debug("updateCartTotals()", err);
        return Promise.reject(new Error('Error in updateCartTotals()'));
    }
}

export async function updateCartPrinted(cartId: number | string, userId: number, printed: boolean): Promise<B2BCart | null> {
    try {
        debug('updateCartPrinted()', {cartId, userId, printed});
        const sql = `
            UPDATE b2b.cart_header
            SET printed = JSON_ARRAY_APPEND(
                    IFNULL(printed, '[]'),
                    '$',
                    JSON_OBJECT('printed', :printed,
                                'userId', :userId,
                                'timestamp', NOW()
                    ))
            WHERE id = :cartId
              AND salesOrderNo IS NOT NULL
              AND orderType <> 'Q'`;
        const data = {cartId, userId, printed};
        await mysql2Pool.query(sql, data);
        return await loadCart({cartId, userId}, 'O');
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("updateCartPrinted()", err.message);
            return Promise.reject(err);
        }
        debug("updateCartPrinted()", err);
        return Promise.reject(new Error('Error in updateCartPrinted()'));
    }
}
