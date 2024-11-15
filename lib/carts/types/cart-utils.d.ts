import {PricingMethodType, SalesOrder} from "b2b-types";
import {FullPriceCode} from "chums-types";
import {Item} from "chums-types";
import {RowDataPacket} from "mysql2";
import {B2BCartDetail} from "./cart-detail.d.ts";
import {B2BCartHeader} from "./cart-header.d.ts";

export interface B2BCartDetailRow extends RowDataPacket, Omit<B2BCartDetail, 'pricing' | 'cartProduct'|'soDetail'> {
    pricing: string;
    cartProduct: string;
    soDetail:string;
}

export interface B2BCartHeaderRow extends RowDataPacket, Omit<B2BCartHeader, 'createdByUser', 'updatedByUser'> {
    createdByUser: string | null;
    updatedByUser: string | null;
}


export interface SageSalesOrderResponse {
    error?: sting;
    message?: string;
    result?: SalesOrder[];
}

export type B2BCartSyncHeader = Omit<B2BCartHeader, 'id'>

export type B2BCartSyncLine = Omit<B2BCartLine, 'id' | 'cartHeaderId' | 'dateCreated' | 'dateImported'>


export interface FetchFromSageResponse {
    result?: SalesOrder[];
}

export interface B2BCartItemPriceCode extends FullPriceCode {
    PriceCodeRecord: '0'|'1'|'2'|null;
    PricingMethod: PricingMethodType | null;
    DiscountMarkup: number | null;
    CustomerPriceLevel: string | null;
}
export type B2BCartItemPrice = Pick<Item, 'ItemType'|'ItemCode'|'PriceCode'|'StandardUnitCost'|'StandardUnitPrice'|'SuggestedRetailPrice'>
    & Pick<B2BCartItemPriceCode, 'PriceCodeRecord'|'PricingMethod'|'DiscountMarkup1'|'CustomerPriceLevel'>;


export type B2BCustomer = Required<Pick<B2BCartHeader, 'arDivisionNo'|'customerNo'>> & Partial<Pick<B2BCartHeader, 'shipToCode'>>;


export type UnitOfMeasureLookup = Pick<B2BCartDetail, 'unitOfMeasure'|'unitOfMeasureConvFactor'>
