import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:carts:load-cart');
export async function loadCarts({ userId, cartId, customerKey }) {
    try {
        const sql = `SELECT h.id,
                            h.salesOrderNo,
                            h.orderType,
                            h.orderStatus,
                            h.arDivisionNo,
                            h.customerNo,
                            h.shipToCode,
                            c.CustomerName                                 AS customerName,
                            st.ShipToName                                  AS shipToName,
                            h.customerKey,
                            h.salespersonDivisionNo,
                            h.salespersonNo,
                            h.salespersonKey,
                            sp.SalespersonName                             AS salespersonName,
                            h.customerPONo,
                            h.shipExpireDate,
                            h.shipVia,
                            h.promoCode,
                            h.comment,
                            h.subTotalAmt,
                            h.dateCreated,
                            IF(ISNULL(h.createdByUserId), NULL,
                               JSON_OBJECT('id', h.createdByUserId,
                                           'email', uc.email,
                                           'name', uc.name,
                                           'company', uc.company,
                                           'accountType', uc.accountType)) AS createdByUser,
                            h.dateUpdated,
                            IF(ISNULL(h.updatedByUseId), NULL,
                               JSON_OBJECT('id', h.updatedByUseId,
                                           'email', uu.email,
                                           'name', uu.name,
                                           'company', uu.company,
                                           'accountType', uu.accountType)) AS updatedByUser,
                            h.dateImported,
                            st.ShipToName,
                            st.ShipToAddress1,
                            st.ShipToAddress2,
                            st.ShipToAddress3,
                            st.ShipToCity,
                            st.ShipToState,
                            st.ShipToZipCode,
                            st.ShipToCountryCode,
                            IFNULL(soh.SalesTaxAmt, h.salesTaxAmt)         AS salesTaxAmt,
                            c.TaxSchedule,
                            soh.FreightAmt,
                            soh.DiscountAmt,
                            soh.DepositAmt
                     FROM b2b.cart_header h
                              INNER JOIN (SELECT DISTINCT ch.id
                                          FROM b2b.cart_header ch
                                                   INNER JOIN users.accounts ua ON
                                              (ua.isRepAccount = 1 AND ch.salespersonKey LIKE ua.accessKey) OR
                                              (ua.isRepAccount = 0 AND ch.customerKey LIKE ua.accessKey)
                                          WHERE ua.userid = :userId
                                            AND (IFNULL(:cartId, '') = '' OR ch.id = :cartId)) AS cu
                                         ON cu.id = h.id
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = 'chums'
                                             AND c.ARDivisionNo = h.arDivisionNo
                                             AND c.CustomerNo = h.customerNo
                              LEFT JOIN c2.SO_ShipToAddress st
                                        ON st.Company = c.Company
                                            AND st.ARDivisionNo = c.ARDivisionNo
                                            AND st.CustomerNo = c.CustomerNo
                                            AND st.ShipToCode = h.shipToCode
                              LEFT JOIN c2.ar_salesperson sp
                                        ON sp.Company = 'chums'
                                            AND sp.SalespersonDivisionNo = h.salespersonDivisionNo
                                            AND sp.SalespersonNo = h.salespersonNo
                              LEFT JOIN users.users uc ON uc.id = h.createdByUserId
                              LEFT JOIN users.users uu ON uu.id = h.updatedByUseId
                              LEFT JOIN c2.SO_SalesOrderHeader soh
                                        ON soh.Company = c.Company AND soh.SalesOrderNo = h.salesOrderNo
                     WHERE c.CustomerStatus = 'A'
                       AND h.orderType = 'Q'
                       AND h.orderStatus NOT IN ('Z')
                       AND (IFNULL(:cartId, '') = '' OR h.id = :cartId)
                       AND (IFNULL(:customerKey, '') = '' OR h.customerKey LIKE :customerKey)`;
        if (customerKey && /^[0-9]+-[A-Z0-9]+$/.test(customerKey)) {
            customerKey = `${customerKey}-%`;
        }
        const [rows] = await mysql2Pool.query(sql, { userId, cartId, customerKey });
        return rows.map(row => {
            return {
                ...row,
                createdByUser: JSON.parse(row.createdByUser ?? 'null'),
                updatedByUser: JSON.parse(row.updatedByUser ?? 'null'),
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCart()", err.message);
            return Promise.reject(err);
        }
        debug("loadCart()", err);
        return Promise.reject(new Error('Error in loadCart()'));
    }
}
export async function loadCartDetail({ cartId, userId }) {
    try {
        // @TODO: implement cart detail dateCreated, createdByUser, dateUpdated, updatedByUser, etc.
        const sql = `SELECT d.id,
                            d.cartHeaderId,
                            JSON_OBJECT(
                                    'productId', d.productId,
                                    'productItemId', d.productItemId,
                                    'image', IFNULL(
                                            JSON_VALUE(pi.additionalData, '$.image_filename'),
                                            p.products_image
                                             ),
                                    'colorCode', pi.colorCode,
                                    'swatchCode', NULLIF(
                                            IFNULL(
                                                    NULLIF(JSON_VALUE(pi.additionalData, '$.swatch_code'), ''),
                                                    JSON_VALUE(p.additional_data, '$.swatch_format')),
                                            ''),
                                    'available', a.QuantityAvailable,
                                    'upc', IFNULL(bd.UPC, i.UDF_UPC_BY_COLOR),
                                    'inactiveItem', IF(i.InactiveItem, TRUE, FALSE)
                            )                                    AS cartProduct,
                            JSON_OBJECT(
                                    'code', IFNULL(JSON_VALUE(pi.additionalData, '$.season.code'), ps.code),
                                    'itemAvailable', (
                                        IFNULL(JSON_VALUE(pi.additionalData, '$.seasonAvailable'), 0) = 1
                                            OR ISNULL(JSON_VALUE(pi.additionalData, '$.season.active'))
                                            OR (
                                            JSON_VALUE(pi.additionalData, '$.season.active')
                                                AND
                                            IFNULL(JSON_VALUE(pi.additionalData, '$.season.product_available'), 0)
                                            )
                                        ),
                                    'productAvailable', ISNULL(ps.product_available)
                                        OR IFNULL(ps.active, 0) = 0
                                        OR IFNULL(JSON_EXTRACT(p.additional_data, '$.seasonAvailable'), 0)
                            )                                    AS season,
                            d.itemCode,
                            i.ProductType                        AS productType,
                            d.itemType,
                            IFNULL(i.ItemCodeDesc, '')           AS itemCodeDesc,
                            JSON_OBJECT(
                                    'priceCode', i.PriceCode,
                                    'priceLevel', IFNULL(d.PriceLevel, c.PriceLevel),
                                    'pricingMethod', IFNULL(
                                            IFNULL(pcc.PricingMethod, pci.PricingMethod),
                                            pcpc.PricingMethod),
                                    'breakQuantity', IFNULL(
                                            IFNULL(pcc.BreakQuantity1, pci.BreakQuantity1),
                                            pcpc.BreakQuantity1),
                                    'discountMarkup', IFNULL(
                                            IFNULL(pcc.DiscountMarkup1, pci.DiscountMarkup1),
                                            pcpc.DiscountMarkup1),
                                    'suggestedRetailPrice',
                                    i.SuggestedRetailPrice
                            )                                    AS pricing,
                            IFNULL(d.commentText, '')            AS commentText,
                            d.unitOfMeasure,
                            IFNULL(d.unitOfMeasureConvFactor, 1) AS unitOfMeasureConvFactor,
                            IFNULL(d.quantityOrdered, 0)         AS quantityOrdered,
                            d.unitPrice,
                            d.lineDiscountPercent,
                            d.discount,
                            d.extensionAmt,
                            JSON_OBJECT(
                                    'salesOrderNo', d.salesOrderNo,
                                    'lineKey', d.lineKey,
                                    'productTYpe', i.ProductType,
                                    'itemType', d.itemType,
                                    'salesKitLineKey', sod.SalesKitLineKey,
                                    'explodedKitItem', sod.ExplodedKitItem
                            )                                    AS soDetail,
                            d.dateUpdated
                     FROM b2b.cart_header h
                              INNER JOIN b2b.cart_detail d ON d.cartHeaderId = h.id
                              INNER JOIN (SELECT DISTINCT ch.id
                                          FROM b2b.cart_header ch
                                                   INNER JOIN users.accounts ua ON
                                              (ua.isRepAccount = 1 AND ch.salespersonKey LIKE ua.accessKey) OR
                                              (ua.isRepAccount = 0 AND ch.customerKey LIKE ua.accessKey)
                                          WHERE ua.userid = :userId
                                            AND ch.id = :cartId) AS cu ON cu.id = d.cartHeaderId
                              INNER JOIN c2.CI_Item i ON i.Company = 'chums' AND i.ItemCode = d.itemCode
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = 'chums'
                                             AND c.ARDivisionNo = h.arDivisionNo
                                             AND c.CustomerNo = h.customerNo
                              LEFT JOIN c2.SO_SalesOrderDetail sod
                                        ON sod.Company = 'chums' AND
                                           sod.SalesOrderNo = h.salesOrderNo AND
                                           sod.LineKey = d.lineKey
                              LEFT JOIN c2.im_pricecode pcc
                                        ON pcc.Company = c.Company
                                            AND pcc.PriceCodeRecord = 2
                                            AND pcc.ARDivisionNo = c.ARDivisionNo
                                            AND pcc.CustomerNo = c.CustomerNo
                                            AND pcc.ItemCode = i.ItemCode
                              LEFT JOIN c2.im_pricecode pci
                                        ON pci.Company = i.Company
                                            AND pci.PriceCodeRecord = 1
                                            AND pci.ItemCode = i.ItemCode
                                            AND pci.CustomerPriceLevel = IFNULL(d.priceLevel, c.PriceLevel)
                              LEFT JOIN c2.im_pricecode pcpc
                                        ON pcpc.Company = i.Company
                                            AND pcpc.PriceCodeRecord = 0
                                            AND pcpc.PriceCode = i.PriceCode
                                            AND pcpc.CustomerPriceLevel = IFNULL(d.PriceLevel, c.PriceLevel)
                              LEFT JOIN b2b_oscommerce.products p ON p.products_id = d.productId
                              LEFT JOIN b2b_oscommerce.products_items pi
                                        ON pi.productsID = d.productId AND pi.id = d.productItemId
                              LEFT JOIN c2.v_web_available a
                                        ON a.Company = i.Company
                                            AND a.ItemCode = i.ItemCode
                                            AND a.WarehouseCode = IFNULL(sod.WarehouseCode, i.DefaultWarehouseCode)
                              LEFT JOIN barcodes.bc_customer bc
                                        ON bc.Company = c.Company
                                            AND bc.ARDivisionNo = c.ARDivisionNo
                                            AND bc.CustomerNo = c.CustomerNo
                              LEFT JOIN barcodes.bc_customerdetail bd
                                        ON bd.CustomerID = bc.id
                                            AND bd.ItemNumber = i.ItemCode
                              LEFT JOIN b2b_oscommerce.product_seasons ps ON ps.product_season_id = p.product_season_id
                     WHERE h.id = :cartId
                     AND ifnull(d.lineStatus, '') <> 'X'
                     ORDER BY d.id`;
        const [rows] = await mysql2Pool.query(sql, { cartId, userId });
        return rows.map(row => ({
            ...row,
            pricing: JSON.parse(row.pricing),
            cartProduct: JSON.parse(row.cartProduct),
            soDetail: JSON.parse(row.soDetail),
            season: JSON.parse(row.season),
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCartDetail()", err.message);
            return Promise.reject(err);
        }
        debug("loadCartDetail()", err);
        return Promise.reject(new Error('Error in loadCartDetail()'));
    }
}
export async function loadCart({ cartId, userId }) {
    try {
        const [header] = await loadCarts({ cartId, userId });
        if (!header) {
            return null;
        }
        const detail = await loadCartDetail({ cartId, userId });
        return {
            header,
            detail
        };
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("loadCart()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadCart()", err);
        return Promise.reject(new Error('Error in loadCart()'));
    }
}
