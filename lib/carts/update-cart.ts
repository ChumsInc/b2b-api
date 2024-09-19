import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';

export async function updateCartHeader(id:number) {
    try {
        const sqlDetail = `
        SELECT * 
        FROM b2b.cart_header h 
            INNER JOIN b2b.cart_detail d on d.cartHeaderId = h.id
        INNER JOIN c2.CI_Item i on i.ItemCode = d.itemCode
        LEFT JOIN c2.im_pricecode pc on pc.ARDivisionNo = h.arDivisionNo and pc.CustomerNo = h.customerNo and pc.ItemCode = d.itemCode
        `
    } catch(err:unknown) {
        if (err instanceof Error) {
            return Promise.reject(err);
        }
        return Promise.reject(new Error('Error in updateCartHeader()'));
    }
}

