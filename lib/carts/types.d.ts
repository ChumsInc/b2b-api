export type CartType = SalesOrderType | '_';

export interface B2BCartHeader extends Partial<Omit<SalesOrderHeader, 'SalesOrderNo'|'OrderType'|'OrderStatus'
    id: number;
    salesOrderNo: string;
    orderType: CartType;
    orderStatus: SalesOrderStatus;
    arDivisionNo:string;
    customerNo: string;
    shipToCode: string|null;
    customerPONo: string|null;
    shipExpireDate: string|null;
    shipVia: string|null;
    promoCode: string|null;
    comment: string|null;
    subTotalAmt: string;
    dateCreated: string;
    dateUpdated: string;
    dateImported: string|null;
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
    | 'test-freight'
    | 'update-item'
    | 'update-line'
    | 'update';


export interface CartActionBase {
    action: CartAction;
    cartId: number;
    promoCode?: string;
    comment?: string;
    versionNo?: string|null;
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
export interface CartAppendCommentBody extends CartActionBase, Omit<CartDetailBody, 'QuantityOrdered' > {
    action: 'line-comment';
}

export interface CartDeleteItemBody extends CartActionBase, Pick<CartDetailBody, 'cartDetailId' > {
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
    salesOrderNo:string;
    promoCode?: string;
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

    priceLevel: string|null;
    commentText: string|null;
    dateUpdated: string;
}