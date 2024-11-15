import {SalesOrderHeader, SalesOrderStatus, SalesOrderType, UserProfile} from "b2b-types";

export type CartType = SalesOrderType | '_';

export type B2BUserInfo = Pick<UserProfile, 'id' | 'email' | 'name' | 'accountType' | 'company'>;

export interface B2BCartHeader extends Partial<Omit<SalesOrderHeader, 'SalesOrderNo' | 'OrderType' | 'OrderStatus'
    | 'ARDivisionNo' | 'CustomerNo' | 'ShipToCode' | 'SalespersonDivisionNo' | 'SalespersonNo' | 'CustomerPONo'
    | 'ShipExpireDate' | 'ShipVia' | 'UDF_PROMO_DEAL' | 'Comment'>> {
    id: number;
    salesOrderNo: string;
    orderType: CartType;
    orderStatus: SalesOrderStatus;
    arDivisionNo: string;
    customerNo: string;
    shipToCode: string | null;
    customerName: string;
    shipToName: string | null;
    customerKey: string;
    salespersonDivisionNo: string | null;
    salespersonNo: string | null;
    salespersonKey: string;
    salespersonName: string | null;
    customerPONo: string | null;
    shipExpireDate: string | null;
    shipVia: string | null;
    promoCode: string | null;
    comment: string | null;
    subTotalAmt: string;
    dateCreated: string;
    createdByUser: B2BUserInfo | null;
    dateUpdated: string;
    updatedByUser: B2BUserInfo | null;
    dateImported: string | null;
}
