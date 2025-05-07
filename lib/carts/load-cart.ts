import Debug from 'debug';
import {mysql2Pool} from "chums-local-modules";
import {LoadCartDetailProps, LoadCartProps, LoadCartsProps} from "./types/cart-action-props.js";
import {B2BCartHeader, B2BUserInfo, CartPrintStatus} from "./types/cart-header.js";
import {B2BCartDetail} from "./types/cart-detail.js";
import {B2BCart, CartStatusProp} from "./types/cart.js";
import {B2BCartDetailRow, B2BCartHeaderRow} from "./types/cart-utils.js";

const debug = Debug('chums:lib:carts:load-cart');

/*
    status flags:
    'O' - open order
    'C' - cart
 */
export async function loadCartHeader({userId}: LoadCartsProps, status?: CartStatusProp):Promise<B2BCartHeader[]>;
export async function loadCartHeader({userId, customerKey}: LoadCartsProps, status?: CartStatusProp):Promise<B2BCartHeader[]>;
export async function loadCartHeader({userId, customerKey, cartId}: LoadCartsProps, status?: CartStatusProp):Promise<B2BCartHeader[]>;
export async function loadCartHeader({
                                    userId,
                                    cartId,
                                    customerKey
                                }: LoadCartsProps, status?: CartStatusProp): Promise<B2BCartHeader[]> {
    try {
        const sql = `SELECT h.id,
                            h.salesOrderNo,
                            h.orderType,
                            h.orderStatus,
                            h.arDivisionNo,
                            h.customerNo,
                            h.shipToCode,
                            c.CustomerName                                 AS customerName,
                            IFNULL(st.ShipToName, c.CustomerName)          AS shipToName,
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
                            IF(ISNULL(h.importedByUserId), NULL,
                               JSON_OBJECT('id', h.importedByUserId,
                                           'email', up.email,
                                           'name', up.name,
                                           'company', up.company,
                                           'accountType', up.accountType)) AS importedByUser,
                            IFNULL(st.ShipToName, c.CustomerName)          AS ShipToName,
                            IFNULL(st.ShipToAddress1, c.AddressLine1)      AS ShipToAddress1,
                            IFNULL(st.ShipToAddress2, c.AddressLine2)      AS ShipToAddress2,
                            IFNULL(st.ShipToAddress3, c.AddressLine3)      AS ShipToAddress3,
                            IFNULL(st.ShipToCity, c.City)                  AS ShipToCity,
                            IFNULL(st.ShipToState, c.State)                AS ShipToState,
                            IFNULL(st.ShipToZipCode, c.ZipCode)            AS ShipToZipCode,
                            IFNULL(st.ShipToCountryCode, c.CountryCode)    AS ShipToCountryCode,
                            IFNULL(soh.SalesTaxAmt, h.salesTaxAmt)         AS salesTaxAmt,
                            c.TaxSchedule,
                            soh.FreightAmt,
                            soh.DiscountAmt,
                            soh.DepositAmt,
                            h.printed,
                            soh.OrderDate
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
                                            AND st.ShipToCode = IFNULL(h.shipToCode, '')
                              LEFT JOIN c2.ar_salesperson sp
                                        ON sp.Company = 'chums'
                                            AND sp.SalespersonDivisionNo = h.salespersonDivisionNo
                                            AND sp.SalespersonNo = h.salespersonNo
                              LEFT JOIN users.users uc ON uc.id = h.createdByUserId
                              LEFT JOIN users.users uu ON uu.id = h.updatedByUseId
                              LEFT JOIN users.users up ON up.id = h.importedByUserId
                              LEFT JOIN c2.SO_SalesOrderHeader soh
                                        ON soh.Company = c.Company AND soh.SalesOrderNo = h.salesOrderNo
                     WHERE c.CustomerStatus = 'A'
                       AND IF(
                             ifnull(:status, 'C') = 'C',  
                             h.orderType in ('Q', '_'), 
                             h.orderType in ('S', 'B') AND h.orderStatus <> 'C'
                           )
                       AND h.orderStatus NOT IN ('X', 'Z')
                       AND (IFNULL(:cartId, '') = '' OR h.id = :cartId)
                       AND (IFNULL(:customerKey, '') = '' OR h.customerKey LIKE :customerKey)`
        if (customerKey && /^[0-9]+-[A-Z0-9]+$/.test(customerKey)) {
            customerKey = `${customerKey}-%`
        }
        const [rows] = await mysql2Pool.query<B2BCartHeaderRow[]>(sql, {userId, cartId, customerKey, status});
        return rows.map(row => {
            return {
                ...row,
                createdByUser: JSON.parse(row.createdByUser ?? 'null') as B2BUserInfo,
                updatedByUser: JSON.parse(row.updatedByUser ?? 'null') as B2BUserInfo,
                importedByUser: JSON.parse(row.importedByUser ?? 'null') as B2BUserInfo,
                printed: JSON.parse(row.printed ?? '[]') as CartPrintStatus[],
            } as B2BCartHeader
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCart()", err.message);
            return Promise.reject(err);
        }
        debug("loadCart()", err);
        return Promise.reject(new Error('Error in loadCart()'));
    }
}

export async function loadCartDetail({cartId, userId}: LoadCartDetailProps): Promise<B2BCartDetail[]> {
    try {
        // @TODO: implement cart detail dateCreated, createdByUser, dateUpdated, updatedByUser, etc.
        const sql = `SELECT d.id,
                            d.cartHeaderId,
                            d.lineKey,
                            sod.LineSeqNo                        AS lineSeqNo,
                            JSON_OBJECT(
                                    'productId', d.productId,
                                    'productItemId', IFNULL(d.productItemId, pi.id),
                                    'categoryKeyword', cat.page_keyword,
                                    'productKeyword', IFNULL(pp.products_keyword, p.products_keyword),
                                    'image', IFNULL(
                                            IFNULL(
                                                    JSON_VALUE(pi.additionalData, '$.image_filename'),
                                                    p.products_image
                                            ), (SELECT filename
                                                FROM c2.PM_Images
                                                WHERE item_code = d.itemCode
                                                  AND active = 1
                                                UNION
                                                SELECT filename
                                                FROM c2.PM_ImageProducts
                                                WHERE item_code = d.itemCode
                                                  AND active = 1
                                                LIMIT 1)
                                             ),
                                    'colorCode', IFNULL(pi.colorCode, p.products_default_color),
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
                                    'active', IFNULL(IFNULL(pis.active, ps.active), 0) = 1,
                                    'available', IF(p.products_sell_as = '4',
                                                    (IFNULL(pis.product_available, 1) = 1 OR
                                                     IFNULL(JSON_VALUE(pi.additionalData, '$.seasonAvailable'), 0) = 1),
                                                    (IFNULL(ps.product_available, 1) = 1 OR
                                                     IFNULL(JSON_VALUE(p.additional_data, '$.seasonAvailable'), 0) = 1)
                                                 )
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
                            d.dateUpdated,
                            d.lineStatus
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
                                        ON pi.productsID = d.productId AND
                                           IF(
                                                   ISNULL(d.productItemId),
                                                   pi.itemCode = d.itemCode,
                                                   pi.id = d.productItemId
                                           )
                              LEFT JOIN b2b_oscommerce.products pp ON pp.products_id = p.default_parent_products_id
                              LEFT JOIN b2b_oscommerce.category_pages cat
                                        ON cat.categorypage_id =
                                           IFNULL(pp.default_categories_id, p.default_categories_id)
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
                              LEFT JOIN b2b_oscommerce.product_seasons pis ON pis.product_season_id =
                                                                              JSON_VALUE(pi.additionalData, '$.season.product_season_id')
                     WHERE h.id = :cartId
                       AND IFNULL(d.lineStatus, '') <> 'X'
                     ORDER BY d.id;
        `
        const [rows] = await mysql2Pool.query<B2BCartDetailRow[]>(sql, {cartId, userId});
        return rows.map(row => ({
            ...row,
            pricing: JSON.parse(row.pricing),
            cartProduct: JSON.parse(row.cartProduct),
            soDetail: JSON.parse(row.soDetail),
            season: JSON.parse(row.season),
        }));
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCartDetail()", err.message);
            return Promise.reject(err);
        }
        debug("loadCartDetail()", err);
        return Promise.reject(new Error('Error in loadCartDetail()'));
    }
}

export async function loadCustomerCarts({userId, customerKey}:LoadCartsProps):Promise<B2BCart[]> {
    try {
        const headers = await loadCartHeader({userId, customerKey}, 'C');
        const carts: B2BCart[] = [];
        for await (const header of headers) {
            const detail = await loadCartDetail({userId, cartId: header.id});
            carts.push({header, detail});
        }
        return carts;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadCustomerCarts()", err.message);
            return Promise.reject(err);
        }
        debug("loadCustomerCarts()", err);
        return Promise.reject(new Error('Error in loadCustomerCarts()'));
    }

}

export async function loadCart({cartId, userId}: LoadCartProps, cartStatus?:CartStatusProp): Promise<B2BCart | null> {
    try {
        const [header] = await loadCartHeader({cartId, userId}, cartStatus ?? 'C');
        if (!header) {
            return null;
        }
        const detail = await loadCartDetail({cartId, userId});
        return {
            header,
            detail
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCart()", err.message);
            return Promise.reject(err);
        }
        debug("loadCart()", err);
        return Promise.reject(new Error('Error in loadCart()'));
    }
}

export async function loadCartOrder({cartId, userId}: LoadCartProps): Promise<B2BCart | null> {
    try {
        const [header] = await loadCartHeader({cartId, userId}, 'O');
        if (!header) {
            return null;
        }
        const detail = await loadCartDetail({cartId, userId});
        return {
            header,
            detail
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCart()", err.message);
            return Promise.reject(err);
        }
        debug("loadCart()", err);
        return Promise.reject(new Error('Error in loadCart()'));
    }
}
