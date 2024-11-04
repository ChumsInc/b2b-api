import Debug from 'debug';
import { apiFetchJSON, mysql2Pool } from "chums-local-modules";
import Decimal from "decimal.js";
import { dbDate, dbDateTimeFormat, loadUserIdFromSageUser } from "./utils.js";
import dayjs from "dayjs";
const debug = Debug('chums:lib:carts:sync-cart');
export async function syncFromC2({ id, customerKey, }) {
    try {
        const sqlHeader = `INSERT INTO b2b.cart_header (salesOrderNo, orderType, orderStatus, arDivisionNo, customerNo,
                                                        shipToCode, salespersonDivisionNo, salespersonNo, customerPONo,
                                                        shipExpireDate, shipVia, promoCode, comment, subTotalAmt,
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
                                  (h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt)  AS subTotalAmt,
                                  DATE_ADD(h.DateUpdated, INTERVAL h.TimeUpdated * 3600 SECOND) as dateImported,
                                  date_add(h.DateCreated, INTERVAL h.TimeCreated * 3600 SECOND) as dateCreated,
                                  IFNULL(solc.UserID, sohu.id)                      AS createdByUserId,
                                  IFNULL(IFNULL(solu.UserID, solc.UserId), sohu.id) AS updatedByUserId
                           FROM c2.SO_SalesOrderHeader h
                                    INNER JOIN c2.ar_customer c USING (Company, ARDivisionNo, CustomerNo)
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
                             AND (IFNULL(:id, '') = '' OR
                                  h.SalesOrderNo = (SELECT salesOrderNo FROM b2b.cart_header WHERE id = :id))
                             AND (IFNULL(:customerKey, '') = '' OR
                                  CONCAT_WS('-', h.ARDivisionNo, h.CustomerNo) = :customerKey)
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
                                                   subTotalAmt           = (h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt),
                                                   dateImported          = DATE_ADD(h.DateUpdated, INTERVAL h.TimeUpdated * 3600 SECOND),
                                                   createdByUserId       = ifnull(solc.UserID, sohu.id),
                                                   updatedByUseId        = ifnull(solu.UserId, sohu.id)`;
        const sqlDetailPrep = `UPDATE b2b.cart_detail
                               SET itemStatus = 'X'
                               WHERE (IFNULL(:id, '') = '' OR cartHeaderId = :id)
                                 AND (IFNULL(:customerKey, '') = '' OR cartHeaderId IN (SELECT id
                                                                                        FROM b2b.cart_header
                                                                                        WHERE customerKey LIKE :customerKey))
                                 AND itemStatus = 'I'`;
        const sqlDetail = `INSERT INTO b2b.cart_detail (cartHeaderId, productId, productItemId,
                                                        salesOrderNo, lineKey, itemCode, itemType,
                                                        priceLevel, commentText, unitOfMeasure, quantityOrdered,
                                                        unitPrice, extensionAmt, itemStatus, dateImported)
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
                                  sod.QuantityOrdered,
                                  sod.UnitPrice,
                                  sod.ExtensionAmt,
                                  'I'                                            AS itemStatus,
                                  h.dateUpdated
                           FROM b2b.cart_header h
                                    INNER JOIN c2.SO_SalesOrderDetail sod ON sod.SalesOrderNo = h.salesOrderNo
                                    LEFT JOIN b2b_oscommerce.item_code_to_product_id p ON p.itemCode = sod.ItemCode
                           WHERE (IFNULL(:id, 0) = 0 OR h.id = :id)
                             AND (IFNULL(:customerKey, '') = '' OR h.customerKey = :customerKey)
                           ON DUPLICATE KEY UPDATE productId       = JSON_VALUE(p.productIds, '$[0].productId'),
                                                   productItemId   = JSON_VALUE(p.productIds, '$[0].productItemId'),
                                                   itemCode        = sod.ItemCode,
                                                   itemType        = sod.ItemType,
                                                   priceLevel      = sod.PriceLevel,
                                                   commentText     = sod.CommentText,
                                                   unitOfMeasure   = sod.UnitOfMeasure,
                                                   quantityOrdered = sod.QuantityOrdered,
                                                   unitPrice       = sod.UnitPrice,
                                                   extensionAmt    = sod.ExtensionAmt,
                                                   itemStatus      = 'I'`;
        const sqlDetailClean = `DELETE
                                FROM b2b.cart_detail
                                WHERE itemStatus = 'X'
                                  AND (IFNULL(:id, '') = '' OR cartHeaderId = :id)
                                  AND (IFNULL(:customerKey, '') = '' OR cartHeaderId IN (SELECT id
                                                                                         FROM b2b.cart_header
                                                                                         WHERE customerKey LIKE :customerKey))
        `;
        let b2bCartCustomerKey = customerKey ? `${customerKey}-%` : undefined;
        const updates = {
            header: 0,
            detail: 0,
            deletes: 0,
        };
        let [res] = await mysql2Pool.query(sqlHeader, { id, customerKey });
        updates.header = res.affectedRows;
        await mysql2Pool.query(sqlDetailPrep, { id, customerKey: b2bCartCustomerKey });
        [res] = await mysql2Pool.query(sqlDetail, { id, customerKey });
        updates.detail = res.affectedRows;
        [res] = await mysql2Pool.query(sqlDetailClean, { id, customerKey: b2bCartCustomerKey });
        updates.deletes = res.affectedRows;
        return updates;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("syncFromC2()", err.message);
            return Promise.reject(err);
        }
        debug("syncFromC2()", err);
        return Promise.reject(new Error('Error in syncFromC2()'));
    }
}
export async function syncFromSage(salesOrderNo) {
    try {
        const url = `https://intranet.chums.com/node-sage/api/CHI/salesorder/${encodeURIComponent(salesOrderNo)}`;
        const response = await apiFetchJSON(url);
        if (response?.error) {
            return Promise.reject(new Error(response.message ?? response.error));
        }
        if (!response?.result?.length) {
            return Promise.reject(new Error(`SO ${salesOrderNo} not found`));
        }
        const [so] = response.result;
        const userId = await loadUserIdFromSageUser(so.UserCreatedKey);
        const salesOrder = {
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
            action: { action: 'sync', salesOrderNo },
            createdByUserId: userId
        };
        const dateUpdate = dbDate(new Date(), dbDateTimeFormat);
        const detail = so.detail.map((row) => ({
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
            itemStatus: 'I',
            dateUpdated: dateUpdate,
            dateCreated: dayjs(so.DateCreated).format('YYYY-MM-DD'),
        }));
        const sqlHeader = `INSERT INTO b2b.cart_header
                           (salesOrderNo, orderType, orderStatus, arDivisionNo, customerNo, shipToCode,
                            salespersonDivisionNo, salespersonNo,
                            customerPONo, shipExpireDate, shipVia, promoCode, comment, subTotalAmt, createdByUserId, dateCreated)
                           VALUES (:salesOrderNo, :orderType, :orderStatus, :arDivisionNo, :customerNo, :shipToCode,
                                   :salespersonDivisionNo, :salespersonNo,
                                   :customerPONo, :shipExpireDate, :shipVia, :promoCode, :comment, :subTotalAmt, :createdByUserId, :dateCreated)
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
                                                   subTotalAmt           = :subTotalAmt`;
        const sqlDetailPrep = `UPDATE b2b.cart_detail
                               SET itemStatus = 'X'
                               WHERE salesOrderNo = :salesOrderNo
                                 AND itemStatus = 'I'`;
        const sqlDetail = `INSERT INTO b2b.cart_detail (cartHeaderId, salesOrderNo, lineKey, itemCode, itemType,
                                                        priceLevel, commentText, unitOfMeasure, quantityOrdered,
                                                        unitPrice, extensionAmt, itemStatus)
                           VALUES ((SELECT id FROM b2b.cart_header WHERE salesOrderNo = :salesOrderNo),
                                   :salesOrderNo, :lineKey, :itemCode, :itemType,
                                   :priceLevel, :commentText, :unitOfMeasure, :quantityOrdered,
                                   :unitPrice, :extensionAmt, :itemStatus)
                           ON DUPLICATE KEY UPDATE itemCode        = :itemCode,
                                                   itemType        = :itemType,
                                                   priceLevel      = :priceLevel,
                                                   commentText     = :commentText,
                                                   unitOfMeasure   = :unitOfMeasure,
                                                   quantityOrdered = :quantityOrdered,
                                                   unitPrice       = :unitPrice,
                                                   extensionAmt    = :extensionAmt,
                                                   itemStatus      = :itemStatus`;
        const sqlDetailClean = `DELETE
                                FROM b2b.cart_detail
                                WHERE salesOrderNo = :salesOrderNo
                                  AND itemStatus = 'X'`;
        await mysql2Pool.query(sqlHeader, salesOrder);
        await mysql2Pool.query(sqlDetailPrep, { salesOrderNo });
        await Promise.allSettled(detail.map(row => mysql2Pool.query(sqlDetail, row)));
        await mysql2Pool.query(sqlDetailClean, { salesOrderNo });
        return {
            salesOrderNo: so.SalesOrderNo,
            lines: detail.length,
        };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("syncFromSage()", err.message);
            return Promise.reject(err);
        }
        debug("syncFromSage()", err);
        return Promise.reject(new Error('Error in syncFromSage()'));
    }
}
export async function syncToSage(cartId) {
    try {
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("syncToSage()", err.message);
            return Promise.reject(err);
        }
        console.debug("syncToSage()", err);
        return Promise.reject(new Error('Error in syncToSage()'));
    }
}
export async function postSyncCarts(req, res) {
    try {
        const customerKey = req.query.customerKey ?? undefined;
        const id = req.query.id ?? undefined;
        const result = await syncFromC2({ id, customerKey });
        res.json({ ...result });
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("postSyncCarts()", err.message);
            Promise.reject(err);
            return;
        }
        console.debug("postSyncCarts()", err);
        return Promise.reject(new Error('Error in postSyncCarts()'));
    }
}
export async function postSyncSage(req, res) {
    try {
        const salesOrderNo = req.params.salesOrderNo;
        const response = await syncFromSage(salesOrderNo);
        res.json({ ...response });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in ' });
    }
}
