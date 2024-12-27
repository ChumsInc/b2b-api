import {B2BCartHeader} from "./cart-header.d.ts";
import {B2BCartDetail} from "./cart-detail.d.ts";

export interface B2BCart {
    header: B2BCartHeader;
    detail: B2BCartDetail[];
}

/**
 * C - Cart
 * O - Open Order
 */
export type CartStatusProp = 'C'|'O';
