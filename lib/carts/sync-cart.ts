import Debug from 'debug';
import {apiFetchJSON, mysql2Pool} from "chums-local-modules";
import {SalesOrderDetailLine} from "b2b-types";
import Decimal from "decimal.js";
import {dbDate, dbDateTimeFormat, loadUserIdFromSageUser} from "./utils.js";
import {Request, Response} from 'express'
import {ResultSetHeader} from "mysql2";
import dayjs from "dayjs";
import {B2BCartSyncHeader, B2BCartSyncLine, SageSalesOrderResponse} from "./types/cart-utils.js";

const debug = Debug('chums:lib:carts:sync-cart');

export interface SyncFromC2Props {
    cartId?: string | number;
    customerKey?: string
}

export interface SyncFromC2Response {
    closed: number;
    header: number;
    detail: number;
    deletes: number;
}

export async function syncFromC2({
                                     cartId,
                                     customerKey,
                                 }: SyncFromC2Props): Promise<SyncFromC2Response> {
    try {
        const sqlUpdateStatus = `
            UPDATE b2b.cart_header h
                INNER JOIN c2.SO_SalesOrderHistoryHeader so
                ON so.SalesOrderNo = h.salesOrderNo AND so.Company = 'chums'
            SET h.orderType   = so.OrderType,
                h.orderStatus = so.OrderStatus
            WHERE so.OrderType <> 'Q'
              AND (
                IFNULL(:cartId, '') = ''
                    OR h.SalesOrderNo = (SELECT salesOrderNo FROM b2b.cart_header WHERE id = :cartId)
                )
              AND (
                IFNULL(:customerKey, '') = ''
                    OR CONCAT_WS('-', h.ARDivisionNo, h.CustomerNo, IFNULL(h.ShipToCode, '')) LIKE :customerKey
                )
        `;
        const sqlHeader = `INSERT INTO b2b.cart_header (salesOrderNo, orderType, orderStatus, arDivisionNo, customerNo,
                                                        shipToCode, salespersonDivisionNo, salespersonNo, customerPONo,
                                                        shipExpireDate, shipVia, promoCode, comment,
                                                        taxableAmt, nonTaxableAmt, discountAmt, subTotalAmt,
                                                        salesTaxAmt,
                                                        dateImported, dateCreated, createdByUserId, updatedByUseId)
                           SELECT h.SalesOrderNo,
                                  h.OrderType,
                                  h.OrderStatus,
                                  h.ARDivisionNo,
                                  h.CustomerNo,
                                  h.ShipToCode,
                                  h.SalespersonDivisionNo,
                                  h.SalespersonNo,
                                  h.CustomerPONo,
                                  h.ShipExpireDate,
                                  h.ShipVia,
                                  h.UDF_PROMO_DEAL,
                                  h.Comment,
                                  h.TaxableAmt                                                  AS taxableAmt,
                                  h.NonTaxableAmt                                               AS nonTaxableAmt,
                                  h.DiscountAmt                                                 AS discountAmt,
                                  (h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt)              AS subTotalAmt,
                                  h.SalesTaxAmt                                                 AS salesTaxAmt,
                                  DATE_ADD(h.DateUpdated, INTERVAL h.TimeUpdated * 3600 SECOND) AS dateImported,
                                  DATE_ADD(h.DateCreated, INTERVAL h.TimeCreated * 3600 SECOND) AS dateCreated,
                                  IFNULL(solc.UserID, sohu.id)                                  AS createdByUserId,
                                  IFNULL(IFNULL(solu.UserID, solc.UserId), sohu.id)             AS updatedByUserId
                           FROM c2.SO_SalesOrderHeader h
                                    INNER JOIN c2.ar_customer c USING (Company, ARDivisionNo, CustomerNo)
                                    LEFT JOIN b2b.cart_header ch ON ch.salesOrderNo = h.SalesOrderNo
                                    LEFT JOIN (SELECT UserId, l.SalesOrderNo
                                               FROM b2b.SalesOrderLog l
                                                        INNER JOIN c2.SO_SalesOrderHeader soh
                                                                   ON soh.Company = l.dbCompany AND soh.SalesOrderNo = l.SalesOrderNo
                                               WHERE JSON_VALUE(action, '$.action') IN ('new', 'duplicate')
                                               UNION
                                               SELECT UserId, lh.SalesOrderNo
                                               FROM b2b.SalesOrderHistory lh
                                                        INNER JOIN c2.SO_SalesOrderHeader soh
                                                                   ON soh.Company = lh.dbCompany AND soh.SalesOrderNo = lh.SalesOrderNo
                                               WHERE JSON_VALUE(action, '$.action') IN ('new', 'duplicate')) solc
                                              ON solc.SalesOrderNo = h.SalesOrderNo
                                    LEFT JOIN (SELECT l.SalesOrderNo,
                                                      IFNULL(lh.UserId, l.UserId)       AS UserId,
                                                      IFNULL(lh.timestamp, l.timestamp) AS timestamp
                                               FROM b2b.SalesOrderLog l
                                                        INNER JOIN c2.SO_SalesOrderHeader soh
                                                                   ON soh.Company = l.dbCompany AND soh.SalesOrderNo = l.SalesOrderNo
                                                        LEFT JOIN (SELECT UserID, lh.SalesOrderNo, MAX(lh.timestamp) AS timestamp
                                                                   FROM b2b.SalesOrderHistory lh
                                                                            INNER JOIN c2.SO_SalesOrderHeader soh
                                                                                       ON soh.Company = lh.dbCompany AND soh.SalesOrderNo = lh.SalesOrderNo
                                                                   WHERE JSON_VALUE(action, '$.action') NOT IN ('printed')
                                                                   GROUP BY SalesOrderNo) lh
                                                                  ON lh.SalesOrderNo = l.SalesOrderNo
                                               WHERE JSON_VALUE(l.action, '$.action') <> 'new') solu
                                              ON solu.SalesOrderNo = h.SalesOrderNo
                                    LEFT JOIN (SELECT u.id, su.UserKey
                                               FROM users.users u
                                                        INNER JOIN c2.SY_User su ON su.EmailAddress = u.email
                                               WHERE IFNULL(su.EmailAddress, '') <> '') sohu
                                              ON sohu.UserKey = h.UserCreatedKey
                           WHERE c.CustomerStatus = 'A'
                             AND h.OrderType = 'Q'
                             AND (IFNULL(:cartId, '') = '' OR
                                  h.SalesOrderNo = (SELECT salesOrderNo FROM b2b.cart_header WHERE id = :cartId))
                             AND (IFNULL(:customerKey, '') = '' OR
                                  CONCAT_WS('-', h.ARDivisionNo, h.CustomerNo, IFNULL(h.ShipToCode, '')) LIKE
                                  :customerKey)
                             AND (
                               ISNULL(ch.dateUpdated)
                                   OR ch.dateUpdated < DATE_ADD(h.DateUpdated, INTERVAL h.TimeUpdated * 3600 SECOND)
                               )
                           ON DUPLICATE KEY UPDATE orderType             = h.OrderType,
                                                   orderStatus           = h.OrderStatus,
                                                   arDivisionNo          = h.ARDivisionNo,
                                                   customerNo            = h.CustomerNo,
                                                   shipToCode            = h.ShipToCode,
                                                   salespersonDivisionNo = h.SalespersonDivisionNo,
                                                   salespersonNo         = h.SalespersonNo,
                                                   customerPONo          = h.CustomerPONo,
                                                   shipExpireDate        = h.ShipExpireDate,
                                                   shipVia               = h.ShipVia,
                                                   promoCode             = h.UDF_PROMO_DEAL,
                                                   comment               = h.Comment,
                                                   taxableAmt            = h.TaxableAmt,
                                                   nonTaxableAmt         = h.NonTaxableAmt,
                                                   discountAmt           = h.DiscountAmt,
                                                   subTotalAmt           = (h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt),
                                                   salesTaxAmt           = h.SalesTaxAmt,
                                                   dateImported          = DATE_ADD(h.DateUpdated, INTERVAL h.TimeUpdated * 3600 SECOND),
                                                   createdByUserId       = IFNULL(solc.UserID, sohu.id),
                                                   updatedByUseId        = IFNULL(solu.UserId, sohu.id)`;
        const sqlDetailPrep = `UPDATE b2b.cart_detail
                               SET lineStatus = '_'
                               WHERE lineStatus = 'I'
                                 AND (IFNULL(:cartId, '') = '' OR cartHeaderId = :cartId)
                                 AND (
                                   IFNULL(:customerKey, '') = ''
                                       OR cartHeaderId IN (SELECT id
                                                           FROM b2b.cart_header
                                                           WHERE customerKey LIKE :customerKey
                                                             AND orderType = 'Q'
                                                             AND orderStatus NOT IN ('Z', 'C'))
                                   )`
        const sqlDetail = `INSERT INTO b2b.cart_detail (cartHeaderId, productId, productItemId, salesOrderNo,
                                                        lineKey, itemCode, itemType, priceLevel, commentText,
                                                        unitOfMeasure, unitOfMeasureConvFactor, quantityOrdered,
                                                        unitPrice, discount, lineDiscountPercent, extensionAmt,
                                                        taxClass, taxAmt, taxRate, lineStatus, dateImported)
                           SELECT h.id,
                                  JSON_VALUE(p.productIds, '$[0].productId')     AS productId,
                                  JSON_VALUE(p.productIds, '$[0].productItemId') AS productItemId,
                                  sod.SalesOrderNo,
                                  sod.LineKey,
                                  sod.ItemCode,
                                  sod.ItemType,
                                  sod.PriceLevel,
                                  sod.CommentText,
                                  sod.UnitOfMeasure,
                                  sod.UnitOfMeasureConvFactor,
                                  sod.QuantityOrdered,
                                  sod.UnitPrice,
                                  sod.Discount,
                                  sod.LineDiscountPercent,
                                  sod.ExtensionAmt,
                                  sod.TaxClass,
                                  sod.TaxAmt,
                                  sod.TaxRate,
                                  'I'                                            AS lineStatus,
                                  h.dateUpdated
                           FROM b2b.cart_header h
                                    INNER JOIN c2.SO_SalesOrderDetail sod ON sod.SalesOrderNo = h.salesOrderNo
                                    LEFT JOIN b2b.cart_detail cd
                                              ON cd.cartHeaderId = h.id AND cd.lineKey = sod.LineKey
                                    LEFT JOIN b2b_oscommerce.item_code_to_product_id p ON p.itemCode = sod.ItemCode
                           WHERE (IFNULL(:cartId, 0) = 0 OR h.id = :cartId)
                             AND (IFNULL(:customerKey, '') = '' OR h.customerKey LIKE :customerKey)
                             AND IFNULL(cd.lineStatus, '') <> 'X'
                           ON DUPLICATE KEY UPDATE productId               = JSON_VALUE(p.productIds, '$[0].productId'),
                                                   productItemId           = JSON_VALUE(p.productIds, '$[0].productItemId'),
                                                   itemCode                = sod.ItemCode,
                                                   itemType                = sod.ItemType,
                                                   priceLevel              = sod.PriceLevel,
                                                   commentText             = sod.CommentText,
                                                   unitOfMeasure           = sod.UnitOfMeasure,
                                                   unitOfMeasureConvFactor = sod.unitOfMeasureConvFactor,
                                                   quantityOrdered         = sod.QuantityOrdered,
                                                   unitPrice               = sod.UnitPrice,
                                                   discount                = IFNULL(sod.Discount, 0),
                                                   lineDiscountPercent     = IFNULL(sod.LineDiscountPercent, 0),
                                                   extensionAmt            = sod.ExtensionAmt,
                                                   taxClass                = sod.TaxClass,
                                                   taxAmt                  = sod.TaxAmt,
                                                   taxRate                 = sod.TaxRate,
                                                   lineStatus              = 'I'`;
        const sqlDetailClean = `UPDATE b2b.cart_detail
                                SET lineStatus = 'X'
                                WHERE lineStatus = '_'
                                  AND (IFNULL(:cartId, '') = '' OR cartHeaderId = :cartId)
                                  AND (
                                    IFNULL(:customerKey, '') = ''
                                        OR cartHeaderId IN (SELECT id
                                                            FROM b2b.cart_header
                                                            WHERE customerKey LIKE :customerKey)
                                    )
        `;
        let b2bCartCustomerKey = customerKey ? `${customerKey}-%` : undefined;

        const updates: SyncFromC2Response = {
            closed: 0,
            header: 0,
            detail: 0,
            deletes: 0,
        }
        let [res] = await mysql2Pool.query<ResultSetHeader>(sqlUpdateStatus, {cartId, customerKey: b2bCartCustomerKey});
        updates.closed = res.affectedRows;

        [res] = await mysql2Pool.query<ResultSetHeader>(sqlHeader, {cartId, customerKey: b2bCartCustomerKey});
        updates.header = res.affectedRows;

        await mysql2Pool.query<ResultSetHeader>(sqlDetailPrep, {cartId, customerKey: b2bCartCustomerKey});
        [res] = await mysql2Pool.query<ResultSetHeader>(sqlDetail, {cartId, customerKey: b2bCartCustomerKey});
        updates.detail = res.affectedRows;

        [res] = await mysql2Pool.query<ResultSetHeader>(sqlDetailClean, {cartId, customerKey: b2bCartCustomerKey});
        updates.deletes = res.affectedRows;
        // debug('syncFromC2()', customerKey, cartId, updates);
        return updates;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("syncFromC2()", err.message);
            return Promise.reject(err);
        }
        debug("syncFromC2()", err);
        return Promise.reject(new Error('Error in syncFromC2()'));
    }
}

interface SyncFromSageResponse {
    error?: string;
    salesOrderNo?: string | null;
    lines?: number;
}

export async function syncFromSage(salesOrderNo: string): Promise<SyncFromSageResponse | null> {
    try {
        const url = `https://intranet.chums.com/node-sage/api/CHI/salesorder/${encodeURIComponent(salesOrderNo)}`;
        const response = await apiFetchJSON<SageSalesOrderResponse>(url);
        if (response?.error) {
            return Promise.reject(new Error(response.message ?? response.error));
        }
        if (!response?.result?.length) {
            return Promise.reject(new Error(`SO ${salesOrderNo} not found`));
        }
        const [so] = response.result;
        const userId = await loadUserIdFromSageUser(so.UserCreatedKey);
        const salesOrder: B2BCartSyncHeader = {
            salesOrderNo: so.SalesOrderNo,
            orderType: so.OrderType,
            orderStatus: so.OrderStatus,
            arDivisionNo: so.ARDivisionNo,
            customerNo: so.CustomerNo,
            shipToCode: so.ShipToCode,
            salespersonDivisionNo: so.SalespersonDivisionNo,
            salespersonNo: so.SalespersonNo,
            customerPONo: so.CustomerPONo,
            shipExpireDate: dbDate(so.ShipExpireDate),
            shipVia: so.ShipVia,
            promoCode: so.UDF_PROMO_DEAL,
            comment: so.Comment,
            subTotalAmt: new Decimal(so.TaxableAmt).add(so.NonTaxableAmt).sub(so.DiscountAmt).toString(),
            action: {action: 'sync', salesOrderNo},
            createdByUserId: userId
        }
        const dateUpdate = dbDate(new Date(), dbDateTimeFormat);
        const detail: B2BCartSyncLine[] = so.detail.map((row: SalesOrderDetailLine) => ({
            salesOrderNo: salesOrder.salesOrderNo,
            lineKey: row.LineKey,
            itemCode: row.ItemCode,
            itemType: row.ItemType,
            priceLevel: row.PriceLevel,
            commentText: row.CommentText,
            quantityOrdered: row.QuantityOrdered,
            unitOfMeasure: row.UnitOfMeasure,
            unitPrice: row.UnitPrice,
            extensionAmt: row.ExtensionAmt,
            lineStatus: 'I',
            dateUpdated: dateUpdate,
            dateCreated: dayjs(so.DateCreated).format('YYYY-MM-DD'),
        }));

        const sqlHeader = `INSERT INTO b2b.cart_header
                           (salesOrderNo, orderType, orderStatus, arDivisionNo, customerNo, shipToCode,
                            salespersonDivisionNo, salespersonNo, customerPONo, shipExpireDate,
                            shipVia, promoCode, comment, subTotalAmt, createdByUserId, dateCreated)
                           VALUES (:salesOrderNo, :orderType, :orderStatus, :arDivisionNo, :customerNo, :shipToCode,
                                   :salespersonDivisionNo, :salespersonNo, :customerPONo, :shipExpireDate,
                                   :shipVia, :promoCode, :comment, :subTotalAmt, :createdByUserId, :dateCreated)
                           ON DUPLICATE KEY UPDATE orderType             = :orderType,
                                                   orderStatus           = :orderStatus,
                                                   arDivisionNo          = :arDivisionNo,
                                                   customerNo            = :customerNo,
                                                   shipToCode            = :shipToCode,
                                                   salespersonDivisionNo = :salespersonDivisionNo,
                                                   salespersonNo         = :salespersonNo,
                                                   customerPONo          = :customerPONo,
                                                   shipExpireDate        = :shipExpireDate,
                                                   shipVia               = :shipVia,
                                                   promoCode             = :promoCode,
                                                   comment               = :comment,
                                                   subTotalAmt           = :subTotalAmt
        `
        const sqlDetailPrep = `UPDATE b2b.cart_detail
                               SET lineStatus = 'X'
                               WHERE salesOrderNo = :salesOrderNo
                                 AND lineStatus = 'I'`;
        const sqlDetail = `INSERT INTO b2b.cart_detail (cartHeaderId, salesOrderNo, lineKey, itemCode, itemType,
                                                        priceLevel, commentText, unitOfMeasure, quantityOrdered,
                                                        unitPrice, extensionAmt, lineStatus)
                           VALUES ((SELECT id FROM b2b.cart_header WHERE salesOrderNo = :salesOrderNo),
                                   :salesOrderNo, :lineKey, :itemCode, :itemType,
                                   :priceLevel, :commentText, :unitOfMeasure, :quantityOrdered,
                                   :unitPrice, :extensionAmt, :lineStatus)
                           ON DUPLICATE KEY UPDATE itemCode        = :itemCode,
                                                   itemType        = :itemType,
                                                   priceLevel      = :priceLevel,
                                                   commentText     = :commentText,
                                                   unitOfMeasure   = :unitOfMeasure,
                                                   quantityOrdered = :quantityOrdered,
                                                   unitPrice       = :unitPrice,
                                                   extensionAmt    = :extensionAmt,
                                                   lineStatus      = :lineStatus`;
        const sqlDetailClean = `DELETE
                                FROM b2b.cart_detail
                                WHERE salesOrderNo = :salesOrderNo
                                  AND lineStatus = 'X'`;
        await mysql2Pool.query(sqlHeader, salesOrder);
        await mysql2Pool.query(sqlDetailPrep, {salesOrderNo});
        await Promise.allSettled(detail.map(row => mysql2Pool.query(sqlDetail, row)));
        await mysql2Pool.query(sqlDetailClean, {salesOrderNo});
        return {
            salesOrderNo: so.SalesOrderNo,
            lines: detail.length,
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("syncFromSage()", err.message);
            return Promise.reject(err);
        }
        debug("syncFromSage()", err);
        return Promise.reject(new Error('Error in syncFromSage()'));
    }
}

export async function syncToSage(cartId: number): Promise<unknown> {
    try {

    } catch (err: unknown) {
        if (err instanceof Error) {
            console.debug("syncToSage()", err.message);
            return Promise.reject(err);
        }
        console.debug("syncToSage()", err);
        return Promise.reject(new Error('Error in syncToSage()'));
    }
}

export async function postSyncCarts(req: Request, res: Response): Promise<void> {
    try {
        const customerKey = req.query.customerKey as string ?? undefined;
        const cartId = req.query.id as string ?? undefined;
        const result = await syncFromC2({cartId, customerKey});
        res.json({...result});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("postSyncCarts()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postSyncCarts'});
    }
}

export async function postSyncSage(req: Request, res: Response): Promise<void> {
    try {
        const salesOrderNo = req.params.salesOrderNo;
        const response = await syncFromSage(salesOrderNo);
        res.json({...response});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in '});
    }
}
