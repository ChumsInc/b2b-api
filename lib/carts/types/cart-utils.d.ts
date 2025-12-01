import {B2BCartDetail, B2BCartHeader, PricingMethodType, SalesOrder} from "chums-types/b2b";
import {FullPriceCode, Item} from "chums-types";
import {RowDataPacket} from "mysql2";

export interface B2BCartDetailRow extends RowDataPacket, Omit<B2BCartDetail, 'pricing' | 'cartProduct' | 'soDetail' | 'season'> {
    pricing: string;
    cartProduct: string;
    soDetail: string;
    season: string;
}

export interface B2BCartHeaderRow extends RowDataPacket, Omit<B2BCartHeader, 'createdByUser' | 'updatedByUser' | 'printed' | 'importedByUser'> {
    createdByUser: string | null;
    updatedByUser: string | null;
    importedByUser: string | null;
    printed: string;
}


export interface SageSalesOrderResponse {
    error?: sting;
    message?: string;
    result?: SalesOrder[];
}

export interface B2BCartSyncHeader extends Omit<B2BCartHeader, 'id' | 'customerKey' | 'customerName' | 'shipToName' | 'salespersonName' | 'salespersonKey' | 'dateCreated' | 'createdByUser' | 'dateUpdated' | 'updatedByUser' | 'dateImported' | 'importedByUser' | 'printed'> {
    action: {
        action: string;
        salesOrderNo: string;
    },
    createdByUserId: number | null;
}

export type B2BCartSyncLine = Omit<B2BCartLine, 'id' | 'cartHeaderId' | 'dateCreated' | 'dateImported'>


export interface FetchFromSageResponse {
    result?: SalesOrder[];
}

export interface B2BCartItemPriceCode extends FullPriceCode {
    PriceCodeRecord: '0' | '1' | '2' | null;
    PricingMethod: PricingMethodType | null;
    DiscountMarkup: number | null;
    CustomerPriceLevel: string | null;
}

export type B2BCartItemPrice =
    Pick<Item, 'ItemType' | 'ItemCode' | 'PriceCode' | 'StandardUnitCost' | 'StandardUnitPrice' | 'SuggestedRetailPrice'>
    & Pick<B2BCartItemPriceCode, 'PriceCodeRecord' | 'PricingMethod' | 'DiscountMarkup1' | 'CustomerPriceLevel'>;


export type B2BCustomer =
    Required<Pick<B2BCartHeader, 'arDivisionNo' | 'customerNo'>>
    & Partial<Pick<B2BCartHeader, 'shipToCode'>>;


export type UnitOfMeasureLookup = Pick<B2BCartDetail, 'unitOfMeasure' | 'unitOfMeasureConvFactor'>
