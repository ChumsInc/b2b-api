export async function updateCartHeader(id) {
    try {
        const sqlDetail = `
        SELECT * 
        FROM b2b.cart_header h 
            INNER JOIN b2b.cart_detail d on d.cartHeaderId = h.id
        INNER JOIN c2.CI_Item i on i.ItemCode = d.itemCode
        LEFT JOIN c2.im_pricecode pc on pc.ARDivisionNo = h.arDivisionNo and pc.CustomerNo = h.customerNo and pc.ItemCode = d.itemCode
        `;
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("updateCartHeader()", err.message);
            return Promise.reject(err);
        }
        console.debug("updateCartHeader()", err);
        return Promise.reject(new Error('Error in updateCartHeader()'));
    }
}
