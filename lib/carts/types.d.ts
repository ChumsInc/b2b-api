import {SalesOrder, SalesOrderHeader, SalesOrderStatus, SalesOrderType, ShipToAddress, UserProfile} from "b2b-types";
import {RowDataPacket} from "mysql2";

export type CartType = SalesOrderType | '_';

export interface B2BCart {
    header: B2BCartHeader;
    detail: B2BCartDetail[];
}

export type B2BUserInfo = Pick<UserProfile, 'id'|'email'|'name'|'accountType'|'company'>;

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
    shipToName: string|null;
    customerKey:string;
    salespersonDivisionNo: string | null;
    salespersonNo: string | null;
    salespersonKey:string;
    salespersonName: string|null;
    customerPONo: string | null;
    shipExpireDate: string | null;
    shipVia: string | null;
    promoCode: string | null;
    comment: string | null;
    subTotalAmt: string;
    dateCreated: string;
    createdByUser: B2BUserInfo|null;
    dateUpdated: string;
    updatedByUser: B2BUserInfo|null;
    dateImported: string | null;
}

export interface B2BCartHeaderRow extends RowDataPacket, Omit<B2BCartHeader, 'createdByUser', 'updatedByUser'> {
    createdByUser: string|null;
    updatedByUser: string|null;
}

export interface B2BCartLine {
    id: number;
    cartHeaderId: number;
    productId?: number | null;
    productItemId?: number | null;
    salesOrderNo: string | null;
    lineKey: string | null;
    itemCode: string;
    itemType: string;
    priceLevel: string | null;
    commentText: string | null;
    unitOfMeasure: string;
    quantityOrdered: number;
    unitPrice: string | number;
    extensionAmt: string | number;
    itemStatus: string | null;
    dateCreated: string;
    dateUpdated: string;
    dateImported: string | null;
}


export type CartAction =
    'append'
    | 'append-comment'
    | 'apply-discount'
    | 'delete'
    | 'delete-line'
    | 'duplicate'
    | 'line-comment'
    | 'new'
    | 'promote'
    | 'sync'
    | 'test-freight'
    | 'update-item'
    | 'update-line'
    | 'update';


export interface CartActionBase {
    action: CartAction;
    cartId: number;
    promoCode?: string;
    comment?: string;
    versionNo?: string | null;
    referrer?: string;
    timestamp?: string;
}

export interface CartDetailBody {
    cartDetailId: number;
    itemCode: string;
    quantityOrdered: number;
    commentText?: string;
}

export interface CartAppendBody extends CartActionBase, CartDetailBody {
    action: 'append';
}

//@TODO: Verify this is valid!
export interface CartAppendCommentBody extends CartActionBase, Omit<CartDetailBody, 'QuantityOrdered'> {
    action: 'line-comment';
}

export interface CartDeleteItemBody extends CartActionBase, Pick<CartDetailBody, 'cartDetailId'> {
    action: 'delete-line';
}

export interface PromoteCartBody extends CartActionBase {
    action: 'promote',
    cartName: string;
    shipExpireDate: string;
    shipVia: string;
    paymentType: string;
    shipToCode: string;
    comment: string;
    promoCode: string;
}

export interface DeleteCartBody extends CartActionBase {
    action: 'delete'
}

export interface UpdateCartItemBody extends CartActionBase, Omit<CartDetailBody, 'cartDetailId'> {
    action: 'update-item' | 'append';
    cartDetailId?: number;
}

export interface NewCartBody extends CartActionBase, CartDetailBody {
    action: 'new',
    cartName: string;
    promo_code: string;
}

export interface UpdateCartBody extends CartActionBase, ShipToAddress {
    action: 'update';
    cartName: string;
    shipToCode: string;
    confirmTo: string | null;
    changedLines: CartDetailBody[];
    newLines: Omit<CartDetailBody, 'cartDetailId'>[];
}

export interface ApplyPromoCodeBody extends CartActionBase {
    action: 'apply-discount',
    promoCode: string;
}

export interface DuplicateSalesOrderBody extends CartActionBase {
    action: 'duplicate',
    cartName: string;
    salesOrderNo: string;
    promoCode?: string;
}

export interface SyncSalesOrderBody extends Omit<CartActionBase, 'cartId'> {
    action: 'sync',
    salesOrderNo: string;
}


export type CartActionBody =
    CartAppendBody
    | CartAppendCommentBody
    | CartDeleteItemBody
    | PromoteCartBody
    | DeleteCartBody
    | UpdateCartItemBody
    | NewCartBody
    | UpdateCartBody
    | ApplyPromoCodeBody
    | DuplicateSalesOrderBody
    | SyncSalesOrderBody;


export interface SageSalesOrderResponse {
    error?: sting;
    message?: string;
    result?: SalesOrder[];
}

export type B2BCartSyncHeader = Omit<B2BCartHeader, 'id'>

export type B2BCartSyncLine = Omit<B2BCartLine, 'id' | 'cartHeaderId' | 'dateCreated' | 'dateImported'>

export interface B2BCartPricing {
    priceCode: string | null;
    priceLevel: string | null;
    pricingMethod: string | null;
    breakQuantity: number | null;
    discountMarkup: number | null;
}

export interface B2BCartProduct {
    productId: number | null;
    productItemId: number | null;
    image: string | null;
    colorCode: string | null;
    swatchCode: string | null;
    available: string | number | null;
}

export interface B2BCartDetail extends Omit<B2BCartLine, 'priceLevel' | 'productId' | 'productItemId' | 'quantityOrdered' | 'unitOfMeasure'> {
    pricing: B2BCartPricing;
    cartProduct: B2BCartProduct;
    itemCodeDesc: string | null;
    commentText: string | null;
    unitOfMeasure: string | null;
    quantityOrdered: string | number | null;
    dateUpdated: string;
}

export interface B2BCartDetailRow extends RowDataPacket, Omit<B2BCartDetail, 'pricing' | 'cartProduct'> {
    pricing: string;
    cartProduct: string;
}

export interface FetchFromSageResponse {
    result?: SalesOrder[];
}
