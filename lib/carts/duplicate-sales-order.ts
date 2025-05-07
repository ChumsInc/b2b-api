import Debug from 'debug';
import {mysql2Pool} from "chums-local-modules";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {AddToCartBody} from "./types/cart-action-props.js";
import {addItemsToCart} from "./cart-detail-handlers.js";
import {loadCart} from "./load-cart.js";
import {B2BCart} from "./types/cart.js";

const debug = Debug('chums:lib:carts:duplicate-sales-order');

export interface DuplicateSalesOrderProps {
    customerKey: string;
    salesOrderNo: string;
    userId: string | number;
    cartName?: string | null;
    shipToCode?: string | null;
    allowZeroPrice?: boolean;
}

export async function duplicateSalesOrder({
                                              customerKey,
                                              salesOrderNo,
                                              userId,
                                              cartName,
                                              shipToCode,
                                              allowZeroPrice,
                                          }: DuplicateSalesOrderProps): Promise<B2BCart | null> {
    try {
        const sqlHeader = `INSERT INTO b2b.cart_header (salesOrderNo, orderType, orderStatus, arDivisionNo, customerNo,
                                                        shipToCode, salespersonDivisionNo, salespersonNo, customerPONo,
                                                        shipExpireDate, shipVia, comment,
                                                        taxableAmt, nonTaxableAmt, discountAmt, subTotalAmt,
                                                        salesTaxAmt, createdByUserId, updatedByUseId)
                           SELECT NULL                             AS SalesOrderNo,
                                  'Q'                              AS OrderType,
                                  'N'                              AS OrderStatus,
                                  h.ARDivisionNo,
                                  h.CustomerNo,
                                  IFNULL(:shipToCode, h.ShipToCode),
                                  c.SalespersonDivisionNo,
                                  c.SalespersonNo,
                                  IFNULL(:cartName, h.CustomerPONo),
                                  DATE_ADD(NOW(), INTERVAL 1 YEAR) AS ShipExpireDate,
                                  h.ShipVia,
                                  h.Comment,
                                  h.TaxableAmt                     AS taxableAmt,
                                  h.NonTaxableAmt                  AS nonTaxableAmt,
                                  0                                AS discountAmt,
                                  (h.TaxableAmt + h.NonTaxableAmt) AS subTotalAmt,
                                  h.SalesTaxAmt                    AS salesTaxAmt,
                                  :userId                          AS createdByUserId,
                                  :userId                          AS updatedByUserId
                           FROM c2.SO_SalesOrderHistoryHeader h
                                    INNER JOIN c2.ar_customer c USING (Company, ARDivisionNo, CustomerNo)
                                    INNER JOIN (SELECT DISTINCT uc.ARDivisionNo, uc.CustomerNo, NULL AS ShipToCode
                                                FROM users.user_AR_Customer uc
                                                WHERE uc.userid = :userId
                                                UNION
                                                SELECT DISTINCT us.ARDivisionNo, us.CustomerNo, us.ShipToCode
                                                FROM users.user_SO_ShipToAddress us
                                                WHERE us.userid = :userId) AS cu
                                               ON cu.ARDivisionNo = h.ARDivisionNo
                                                   AND cu.CustomerNo = h.CustomerNo
                                                   AND IFNULL(cu.ShipToCode, '') =
                                                       IFNULL(IFNULL(:shipToCode, h.ShipToCode), '')
                           WHERE h.SalesOrderNo = :salesOrderNo
                             AND c.CustomerStatus = 'A'
                             AND (IFNULL(h.orderStatus, '') NOT IN ('X', 'Z'))`;
        const params = {
            userId,
            salesOrderNo,
            cartName,
            shipToCode
        };
        const [result] = await mysql2Pool.query<ResultSetHeader>(sqlHeader, params);
        const cartId = result.insertId;
        if (!cartId) {
            return Promise.reject(new Error('Unable to duplicate this order.'));
        }

        const sqlDetail = `SELECT JSON_VALUE(p.productIds, '$[0].productId')     AS productId,
                                  JSON_VALUE(p.productIds, '$[0].productItemId') AS productItemId,
                                  sod.ItemCode                                   AS itemCode,
                                  sod.ItemType                                   AS itemType,
                                  sod.PriceLevel                                 AS priceLevel,
                                  sod.CommentText                                AS commentText,
                                  sod.UnitOfMeasure                              AS unitOfMeasure,
                                  sod.QuantityOrderedRevised                     AS quantityOrdered,
                                  i.StandardUnitPrice
                           FROM c2.SO_SalesOrderHistoryDetail sod
                                    INNER JOIN c2.CI_Item i ON i.Company = sod.Company AND i.ItemCode = sod.ItemCode
                                    LEFT JOIN b2b_oscommerce.item_code_to_product_id p ON p.itemCode = sod.ItemCode
                           WHERE sod.Company = 'chums'
                             AND sod.SalesOrderNo = :salesOrderNo
                             AND IFNULL(sod.ExplodedKitItem, '') <> 'Y'
                             AND (IF(sod.ItemType = '1', sod.QuantityOrderedRevised > 0, 1))
                             AND i.InactiveItem <> 'Y'
                             AND IFNULL(i.ProductType, '') <> 'D'
                           ORDER BY sod.SequenceNo`;
        const [rows] = await mysql2Pool.query<(AddToCartBody & RowDataPacket)[]>(sqlDetail, {salesOrderNo});
        const cart = await loadCart({cartId, userId});
        if (!cart) {
            return Promise.reject(new Error(`Unable to load duplicated sales order: ${salesOrderNo}`));
        }
        await addItemsToCart(cart, rows, allowZeroPrice);
        return await loadCart({cartId, userId});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("duplicateSalesOrder()", err.message);
            return Promise.reject(err);
        }
        debug("duplicateSalesOrder()", err);
        return Promise.reject(new Error('Error in duplicateSalesOrder()'));
    }
}
