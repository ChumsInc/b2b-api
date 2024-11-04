"use strict";
const sqlUpdateCartHeaders = `
UPDATE b2b.cart_header ch
    INNER JOIN c2.SO_SalesOrderHistoryHeader hh ON hh.Company = 'chums' AND hh.SalesOrderNo = ch.salesOrderNo
    LEFT JOIN c2.SO_SalesOrderHeader soh ON soh.Company = hh.Company AND soh.SalesOrderNo = hh.SalesOrderNo
SET ch.orderType   = IFNULL(soh.OrderTYpe, hh.OrderType),
    ch.orderStatus = IFNULL(soh.OrderStatus, hh.OrderStatus)
WHERE ch.orderType <> IFNULL(soh.OrderTYpe, hh.OrderType)
   OR ch.orderStatus <> IFNULL(soh.OrderStatus, hh.OrderStatus)`;
const sqlUpdateCartCreator = `
    UPDATE b2b.cart_header ch
        INNER JOIN c2.SO_SalesOrderHistoryHeader hh ON hh.Company = 'chums' AND hh.SalesOrderNo = ch.salesOrderNo
        LEFT JOIN c2.SO_SalesOrderHeader soh ON soh.Company = hh.Company AND soh.SalesOrderNo = hh.SalesOrderNo
        INNER JOIN c2.SY_User su ON su.UserKey = IFNULL(soh.UserCreatedKey, hh.UserCreatedKey)
        INNER JOIN users.users u ON u.email = su.EmailAddress
    SET ch.createdByUserId = u.id
    WHERE ch.createdByUserId IS NULL`;
