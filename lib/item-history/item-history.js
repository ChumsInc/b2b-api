export const sql = `
    SELECT i.ItemCode,
           i.ItemCodeDesc,
           i.SalesUnitOfMeasure,
           i.InactiveItem,
           i.ProductType,
           JSON_ARRAYAGG(
                   JSON_OBJECT('year', h.year,
                               'qty', h.QuantityOrderedRevised / IFNULL(i.SalesUMConvFctr, 1),
                               'orders', h.orders
                   )
                   ORDER BY h.year DESC
           )                                                            AS orderHistory,
           SUM(h.QuantityOrderedRevised / IFNULL(i.SalesUMConvFctr, 1)) AS quantityOrdered,
           SUM(h.orders)                                                AS orders
    FROM c2.CI_Item i
             INNER JOIN (SELECT h.Company,
                                d.ItemType,
                                d.ItemCode,
                                YEAR(IFNULL(h.ShipExpireDate, h.OrderDate))               AS year,
                                SUM(d.QuantityOrderedRevised * d.UnitOfMeasureConvFactor) AS QuantityOrderedRevised,
                                COUNT(DISTINCT h.SalesOrderNo)                            AS orders
                         FROM c2.SO_SalesOrderHistoryHeader h
                                  INNER JOIN c2.SO_SalesOrderHistoryDetail d USING (Company, SalesOrderNo)
                         WHERE h.Company = 'chums'
                           AND h.ARDivisionNo = '01'
                           AND h.CustomerNo = 'NC0148'
                           AND h.OrderStatus = 'C'
                         GROUP BY h.Company,
                                  d.ItemType,
                                  d.ItemCode,
                                  YEAR(h.ShipExpireDate)) h
                        ON i.Company = h.Company AND i.ItemCode = h.ItemCode AND i.ItemType = h.ItemType
    WHERE (IFNULL(:includeInactive, 0) = 1 OR (i.InactiveItem = 'N' AND i.ProductType <> 'D'))
      AND h.QuantityOrderedRevised > 0
    GROUP BY i.ItemCode, i.ItemCodeDesc, i.SalesUnitOfMeasure`;
