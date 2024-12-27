INSERT INTO b2b.cart_header (salesOrderNo, orderType, orderStatus, arDivisionNo, customerNo,
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
         INNER JOIN b2b.SalesOrderLog l on l.dbCompany = h.Company and l.SalesOrderNo = h.SalesOrderNo
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
  AND h.OrderType = 'S'
  AND (IFNULL(:cartId, '') = '' OR
       h.SalesOrderNo = (SELECT salesOrderNo FROM b2b.cart_header WHERE id = :cartId))
  AND (IFNULL(:customerKey, '') = '' OR
       CONCAT_WS('-', h.ARDivisionNo, h.CustomerNo, IFNULL(h.ShipToCode, '')) LIKE
       :customerKey)
  AND (ifnull(ch.orderStatus, '') not in ('X', 'Z'))
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
                        shipExpireDate        = h.ShipExpireDate,
                        shipVia               = h.ShipVia,
                        comment               = h.Comment,
                        taxableAmt            = h.TaxableAmt,
                        nonTaxableAmt         = h.NonTaxableAmt,
                        discountAmt           = h.DiscountAmt,
                        subTotalAmt           = (h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt),
                        salesTaxAmt           = h.SalesTaxAmt,
                        dateImported          = DATE_ADD(h.DateUpdated, INTERVAL h.TimeUpdated * 3600 SECOND),
                        createdByUserId       = IFNULL(solc.UserID, sohu.id),
                        updatedByUseId        = IFNULL(solu.UserId, sohu.id);


UPDATE b2b.cart_header ch
INNER JOIN c2.SO_SalesOrderHeader soh on soh.SalesOrderNo = ch.salesOrderNo and soh.Company = 'chums'
set ch.orderType          = soh.OrderType,
    ch.orderStatus        = soh.OrderStatus,
    ch.arDivisionNo          = soh.ARDivisionNo,
    ch.customerNo            = soh.CustomerNo,
    ch.shipToCode            = soh.ShipToCode,
    ch.salespersonDivisionNo = soh.SalespersonDivisionNo,
    ch.salespersonNo         = soh.SalespersonNo,
    ch.shipExpireDate        = soh.ShipExpireDate,
    ch.shipVia               = soh.ShipVia,
    ch.comment               = soh.Comment,
    ch.taxableAmt            = soh.TaxableAmt,
    ch.nonTaxableAmt         = soh.NonTaxableAmt,
    ch.discountAmt           = soh.DiscountAmt,
    ch.subTotalAmt           = (soh.TaxableAmt + soh.NonTaxableAmt - soh.DiscountAmt),
    ch.salesTaxAmt           = soh.SalesTaxAmt,
    ch.dateImported          = DATE_ADD(soh.DateUpdated, INTERVAL soh.TimeUpdated * 3600 SECOND)
where soh.OrderStatus <> 'Q';

UPDATE b2b.cart_header ch
    INNER JOIN b2b.SalesOrderLog l ON l.SalesOrderNo = ch.salesOrderNo
SET ch.printed = JSON_ARRAY_APPEND(
        IFNULL(ch.printed, '[]'),
        '$',
        JSON_OBJECT(
                'printed', TRUE,
                'userId', l.UserID,
                'timestamp', l.timestamp
        ))
WHERE JSON_VALUE(l.action, '$.action') in ('printed', 'print')
  and ch.printed is null;

UPDATE b2b.cart_header ch
    INNER JOIN b2b.SalesOrderHistory l ON l.SalesOrderNo = ch.salesOrderNo
SET ch.printed = JSON_ARRAY_APPEND(
        IFNULL(ch.printed, '[]'),
        '$',
        JSON_OBJECT(
                'printed', TRUE,
                'userId', l.UserID,
                'timestamp', l.timestamp
        ))
WHERE JSON_VALUE(l.action, '$.action') = 'printed'
  and ch.printed is null;


# Sync detail for open orders if needed
UPDATE b2b.cart_detail d
INNER JOIN b2b.cart_header ch on ch.id = d.cartHeaderId
SET d.lineStatus = '_'
WHERE d.lineStatus = 'I'
  AND ch.orderStatus NOT IN ('X', 'Z')
  AND (IFNULL(:cartId, '') = '' OR d.cartHeaderId = :cartId)
  AND (
    IFNULL(:customerKey, '') = ''
        OR d.cartHeaderId IN (SELECT id
                            FROM b2b.cart_header
                            WHERE customerKey LIKE :customerKey
#                               AND orderType = 'Q'
                              AND orderStatus NOT IN ('X', 'Z'))
    );
INSERT INTO b2b.cart_detail (cartHeaderId, productId, productItemId, salesOrderNo,
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
       ifnull(cd.lineStatus, 'I')                                            AS lineStatus,
       h.dateUpdated
FROM b2b.cart_header h
         INNER JOIN c2.SO_SalesOrderDetail sod ON sod.SalesOrderNo = h.salesOrderNo
         LEFT JOIN b2b.cart_detail cd
                   ON cd.cartHeaderId = h.id AND cd.lineKey = sod.LineKey
         LEFT JOIN b2b_oscommerce.item_code_to_product_id p ON p.itemCode = sod.ItemCode
WHERE (IFNULL(:cartId, 0) = 0 OR h.id = :cartId)
  AND (IFNULL(:customerKey, '') = '' OR h.customerKey LIKE :customerKey)
  AND IFNULL(cd.lineStatus, '_') = '_'
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
                        lineStatus              = 'I';
UPDATE b2b.cart_detail
SET lineStatus = 'X'
WHERE lineStatus = '_'
  AND (IFNULL(:cartId, '') = '' OR cartHeaderId = :cartId)
  AND (
    IFNULL(:customerKey, '') = ''
        OR cartHeaderId IN (SELECT id
                            FROM b2b.cart_header
                            WHERE customerKey LIKE :customerKey)
    );

