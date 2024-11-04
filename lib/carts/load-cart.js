import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:carts:load-cart');
export async function loadCarts({ userId, id, customerKey }) {
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
                                           'accountType', uu.accountType))                AS updatedByUser,
                            h.dateImported
                     FROM b2b.cart_header h
                              INNER JOIN (SELECT DISTINCT ch.id
                                          FROM b2b.cart_header ch
                                                   INNER JOIN users.accounts ua ON
                                              (ua.isRepAccount = 1 AND ch.salespersonKey LIKE ua.accessKey) OR
                                              (ua.isRepAccount = 0 AND ch.customerKey LIKE ua.accessKey)
                                          WHERE ua.userid = :userId
                                            AND (IFNULL(:id, '') = '' OR ch.id = :id)) AS cu
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
                     WHERE c.CustomerStatus = 'A'
                       AND h.orderType = 'Q' and h.orderStatus not in ('Z')
                         AND (IFNULL(:id, '') = '' OR h.id = :id)
                       AND (IFNULL(:customerKey, '') = '' OR h.customerKey LIKE :customerKey)`;
        if (customerKey && /^[0-9]+-[A-Z0-9]+$/.test(customerKey)) {
            customerKey = `${customerKey}-%`;
        }
        const [rows] = await mysql2Pool.query(sql, { userId, id, customerKey });
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
export async function loadCartDetail({ id, userId }) {
    try {
        // @TODO: implement cart detail dateCreated, createdByUser, dateUpdated, updatedByUser, etc.
        const sql = `SELECT d.id,
                            d.cartHeaderId,
                            d.salesOrderNo,
                            JSON_OBJECT(
                                    'productId', d.productId,
                                    'productItemId', d.productItemId,
                                    'image', IFNULL(JSON_VALUE(pi.additionalData, '$.image_filename'), p.products_image),
                                    'colorCode', pi.colorCode,
                                    'swatchCode', NULLIF(IFNULL(NULLIF(JSON_VALUE(pi.additionalData, '$.swatch_code'), ''),
                                                                JSON_VALUE(p.additional_data, '$.swatch_format')), ''),
                                    'available', a.QuantityAvailable,
                                    'upc', IFNULL(bd.UPC, i.UDF_UPC_BY_COLOR)
                            )              AS cartProduct,
                            d.lineKey,
                            d.itemCode,
                            d.itemType,
                            i.ItemCodeDesc AS itemCodeDesc,
                            JSON_OBJECT(
                                    'priceCode', i.PriceCode,
                                    'priceLevel', IFNULL(d.PriceLevel, c.PriceLevel),
                                    'pricingMethod', IFNULL(IFNULL(pcc.PricingMethod, pci.PricingMethod), pcpc.PricingMethod),
                                    'breakQuantity', IFNULL(IFNULL(pcc.BreakQuantity1, pci.BreakQuantity1), pcpc.BreakQuantity1),
                                    'discountMarkup', IFNULL(IFNULL(pcc.DiscountMarkup1, pci.DiscountMarkup1), pcpc.DiscountMarkup1)
                            )              AS pricing,
                            d.commentText,
                            d.unitOfMeasure,
                            d.quantityOrdered,
                            'unitPrice', d.unitPrice,
                            'extensionAmt', d.extensionAmt,
                            'suggestedRetailPrice', i.SuggestedRetailPrice,
                            d.dateUpdated
                     FROM b2b.cart_header h
                              INNER JOIN b2b.cart_detail d ON d.cartHeaderId = h.id
                              INNER JOIN (SELECT DISTINCT ch.id
                                          FROM b2b.cart_header ch
                                                   INNER JOIN users.accounts ua ON
                                              (ua.isRepAccount = 1 AND ch.salespersonKey LIKE ua.accessKey) OR
                                              (ua.isRepAccount = 0 AND ch.customerKey LIKE ua.accessKey)
                                          WHERE ua.userid = :userId
                                            AND ch.id = :id) AS cu ON cu.id = d.cartHeaderId
                              INNER JOIN c2.CI_Item i ON i.Company = 'chums' AND i.ItemCode = d.itemCode
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = 'chums'
                                             AND c.ARDivisionNo = h.arDivisionNo
                                             AND c.CustomerNo = h.customerNo
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
                                            AND a.WarehouseCode = i.DefaultWarehouseCode
                              LEFT JOIN barcodes.bc_customer bc
                                        ON bc.Company = c.Company
                                            AND bc.ARDivisionNo = c.ARDivisionNo
                                            AND bc.CustomerNo = c.CustomerNo
                              LEFT JOIN barcodes.bc_customerdetail bd
                                        ON bd.CustomerID = bc.id
                                            AND bd.ItemNumber = i.ItemCode
                     WHERE h.id = :id`;
        const [rows] = await mysql2Pool.query(sql, { id, userId });
        return rows.map(row => ({
            ...row,
            pricing: JSON.parse(row.pricing),
            cartProduct: JSON.parse(row.cartProduct),
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
export async function loadCart({ id, userId }) {
    try {
        const [header] = await loadCarts({ id, userId });
        if (!header) {
            return null;
        }
        const detail = await loadCartDetail({ id, userId });
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
