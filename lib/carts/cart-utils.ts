import {RowDataPacket} from "mysql2";
import {mysql2Pool} from "chums-local-modules";
import Decimal from "decimal.js";
import Debug from "debug";
import type {B2BCartItemPrice, B2BCustomer, UnitOfMeasureLookup} from "./types/cart-utils.d.ts";
import {AddToCartProps} from "./types/cart-action-props.js";

const debug = Debug('chums:lib:carts:cart-utils');

const customerKeyTest = /^([0-9]{2})-([A-Z0-9]+)(?:[-:]*(\S+))?$/;

export async function parseCustomerKey(customerKey:string):Promise<B2BCustomer> {
    if (!customerKeyTest.test(customerKey)) {
        return Promise.reject(new Error('Invalid customer key'));
    }
    const [, arDivisionNo, customerNo, shipToCode] = customerKeyTest.exec(customerKey) ?? [];
    return {
        arDivisionNo,
        customerNo,
        shipToCode: shipToCode ?? null,
    }
}

export type LoadItemPricingProps = B2BCustomer & Pick<AddToCartProps, 'priceLevel' | 'itemCode'>;
export async function loadItemPricing({
                                          arDivisionNo,
                                          customerNo,
                                          itemCode,
                                          priceLevel
                                      }: LoadItemPricingProps): Promise<B2BCartItemPrice | null> {
    try {
        type B2BCartItemPriceRow = B2BCartItemPrice & RowDataPacket;
        if (!priceLevel) {
            priceLevel = await loadCartCustomerPriceLevel({arDivisionNo, customerNo});
        }
        const sql = `SELECT i.ItemType,
                            i.ItemCode,
                            i.PriceCode,
                            i.StandardUnitCost,
                            i.StandardUnitPrice,
                            i.SuggestedRetailPrice,
                            p.PriceCodeRecord,
                            p.CustomerPriceLevel,
                            p.PricingMethod,
                            p.DiscountMarkup1
                     FROM c2.CI_Item i
                              LEFT JOIN c2.im_pricecode p
                                        ON p.Company = i.Company AND
                                           p.PriceCode = i.PriceCode
                     WHERE i.ItemCode = :itemCode
                       AND p.CustomerPriceLevel = :priceLevel

                     UNION

                     SELECT i1.ItemType,
                            i1.ItemCode,
                            i1.PriceCode,
                            i1.StandardUnitCost,
                            i1.StandardUnitPrice,
                            i1.SuggestedRetailPrice,
                            p1.PriceCodeRecord,
                            p1.CustomerPriceLevel,
                            p1.PricingMethod,
                            p1.DiscountMarkup1
                     FROM c2.CI_Item i1
                              INNER JOIN c2.im_pricecode p1
                                         ON p1.Company = i1.Company AND
                                            p1.ItemCode = i1.ItemCode
                     WHERE i1.ItemCode = :itemCode
                       AND p1.PriceCodeRecord = '1'
                       AND p1.CustomerPriceLevel = :priceLevel

                     UNION

                     SELECT i2.ItemType,
                            i2.ItemCode,
                            i2.PriceCode,
                            i2.StandardUnitCost,
                            i2.StandardUnitPrice,
                            i2.SuggestedRetailPrice,
                            p2.PriceCodeRecord,
                            p2.CustomerPriceLevel,
                            p2.PricingMethod,
                            p2.DiscountMarkup1
                     FROM c2.CI_Item i2
                              INNER JOIN c2.im_pricecode p2
                                         ON p2.Company = i2.Company AND
                                            p2.ItemCode = i2.ItemCode
                     WHERE i2.ItemCode = :itemCode
                       AND p2.PriceCodeRecord = '2'
                       AND p2.ARDivisionNo = :arDivisionNo
                       AND p2.CustomerNo = :customerNo

                     UNION

                     SELECT i3.ItemType,
                            i3.ItemCode,
                            i3.PriceCode,
                            i3.StandardUnitCost,
                            i3.StandardUnitPrice,
                            i3.SuggestedRetailPrice,
                            NULL AS PriceCodeRecord,
                            NULL AS CustomerPriceLevel,
                            NULL AS PricingMethod,
                            NULL AS DiscountMarkup1
                     FROM c2.CI_Item i3
                     WHERE i3.ItemCode = :itemCode
                       AND i3.InactiveItem <> 'Y'
                       AND IFNULL(i3.ProductType, '') <> 'D'

                     ORDER BY PriceCodeRecord DESC
                     LIMIT 1
        `;
        const args = {
            itemCode,
            arDivisionNo,
            customerNo,
            priceLevel,
        }
        const [rows] = await mysql2Pool.query<B2BCartItemPriceRow[]>(sql, args);
        if (!rows.length) {
            return null;
        }
        return rows[0] ?? null;

    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadItemPricing()", err.message);
            return Promise.reject(err);
        }
        debug("loadItemPricing()", err);
        return Promise.reject(new Error('Error in loadItemPricing()'));
    }
}

export function parseCustomerPrice(pricing:B2BCartItemPrice, uom:UnitOfMeasureLookup|null):number|string|null {
    switch (pricing.PricingMethod) {
        case 'O':
            return new Decimal(pricing.DiscountMarkup1 ?? 0).times(uom?.unitOfMeasureConvFactor ?? 1).toString();
        case 'P':
            return new Decimal(pricing.StandardUnitPrice).sub(pricing.DiscountMarkup1 ?? 0)
                .times(uom?.unitOfMeasureConvFactor ?? 1).toString();
        case 'C':
            return new Decimal(pricing.StandardUnitCost).add(pricing.DiscountMarkup1 ?? 0)
                .times(uom?.unitOfMeasureConvFactor ?? 1).toString();
        case 'D':
            return new Decimal(pricing.StandardUnitPrice).times(new Decimal(100).sub(pricing.DiscountMarkup1 ?? 0).div(100))
                .times(uom?.unitOfMeasureConvFactor ?? 1).toString();
        case 'M':
            return new Decimal(pricing.StandardUnitCost).times(new Decimal(100).add(pricing.DiscountMarkup1 ?? 0).div(100))
                .times(uom?.unitOfMeasureConvFactor ?? 1).toString();
    }

    if (new Decimal(pricing.StandardUnitPrice).eq(0)) {
        return null;
    }

    return new Decimal(pricing.StandardUnitPrice).times(uom?.unitOfMeasureConvFactor ?? 1).toString();
}

export interface LoadCartCustomerProps {
    arDivisionNo: string;
    customerNo: string;
}

export async function loadCartCustomerPriceLevel(props: LoadCartCustomerProps): Promise<string | null> {
    try {
        interface PriceLevelRow extends RowDataPacket {
            PriceLevel: string;
        }

        const sql = `SELECT c.PriceLevel
                     FROM c2.ar_customer c
                     WHERE c.Company = 'chums'
                       AND c.ARDivisionNo = :arDivisionNo
                       AND c.CustomerNo = :customerNo`
        const [rows] = await mysql2Pool.query<PriceLevelRow[]>(sql, props);
        return rows[0]?.PriceLevel ?? null;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("()", err.message);
            return Promise.reject(err);
        }
        debug("()", err);
        return Promise.reject(new Error('Error in ()'));
    }
}

export async function loadItemUnitOfMeasure(itemCode: string, uom?: string|null):Promise<UnitOfMeasureLookup|null> {
    try {
        const sql = `SELECT SalesUnitOfMeasure AS unitOfMeasure,
                            SalesUMConvFctr    AS unitOfMeasureConvFactor
                     FROM c2.CI_Item
                     WHERE Company = 'chums'
                       AND ItemCode = :itemCode
                       AND ProductType <> 'D'
                       AND SalesUnitOfMeasure = IFNULL(:uom, (SELECT SalesUnitOfMeasure
                                                              FROM c2.CI_Item
                                                              WHERE Company = 'chums'
                                                                AND ItemCode = :itemCode))

                     UNION

                     SELECT StandardUnitOfMeasure AS unitOfMeasure,
                            1                     AS unitOfMeasureConvFactor
                     FROM c2.CI_Item
                     WHERE Company = 'chums'
                       AND ItemCode = :itemCode
                       AND ProductType <> 'D'
                       AND StandardUnitOfMeasure = IFNULL(:uom, (SELECT SalesUnitOfMeasure
                                                                 FROM c2.CI_Item
                                                                 WHERE Company = 'chums'
                                                                   AND ItemCode = :itemCode))

                     LIMIT 1`;
        const [rows] = await mysql2Pool.query<(UnitOfMeasureLookup & RowDataPacket)[]>(sql, {itemCode, uom});
        return rows[0] ?? null;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadItemUnitOfMeasure()", err.message);
            return Promise.reject(err);
        }
        debug("loadItemUnitOfMeasure()", err);
        return Promise.reject(new Error('Error in loadItemUnitOfMeasure()'));
    }
}
