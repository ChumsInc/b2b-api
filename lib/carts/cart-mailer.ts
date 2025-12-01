import {Request, Response} from 'express'
import Debug from "debug";
import {loadCart} from "./load-cart.js";
import {getUserEmail, getUserId, getUserName} from "./utils.js";
import {syncFromC2} from "./sync-cart.js";
import {Decimal} from "decimal.js";
import {B2BCartHeader, EmailDetailLine} from "chums-types/b2b";
import numeral from "numeral";
import dayjs from "dayjs";
import {sendEmail} from "chums-local-modules";
import {SendMailProps} from "chums-local-modules/lib/mailer.js";
import {updateCartTotals} from "./cart-header-handlers.js";

const debug = Debug('chums:lib:carts:cart-mailer');


export async function getCartEmailHTML(req: Request, res: Response): Promise<void> {
    try {
        const customerKey = req.params.customerKey;
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        const content = await buildCartEmail({customerKey, cartId, userId}, res);
        if (!content) {
            res.status(404).json({error: 'Cart not found'});
            return;
        }
        res.send(content.html);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCartEmailHTML()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCartEmailHTML'});
    }
}

export async function getCartEmailText(req: Request, res: Response): Promise<void> {
    try {
        const customerKey = req.params.customerKey;
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        const content = await buildCartEmail({customerKey, cartId, userId}, res);
        if (!content) {
            res.status(404).json({error: 'Cart not found'});
            return;
        }
        res.contentType('text/plain')
            .send(content.textContent);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCartEmailHTML()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCartEmailHTML'});
    }
}

export async function getCartEmailJSON(req: Request, res: Response): Promise<void> {
    try {
        const customerKey = req.params.customerKey;
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        await updateCartTotals(cartId);
        const json = await buildCartEmailData({customerKey, cartId, userId});
        const email = getUserEmail(res);
        if (!json) {
            res.status(404).json({error: 'Cart not found'});
            return;
        }
        res.json({...json, email});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCartEmailHTML()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCartEmailHTML'});
    }
}

export async function sendCartEmail(req: Request, res: Response): Promise<void> {
    try {
        const customerKey = req.params.customerKey;
        const cartId = req.params.cartId;
        const userId = getUserId(res);
        if (!userId) {
            res.status(401).json({error: 'Login is required'});
            return;
        }
        const email = getUserEmail(res)!;
        const name = getUserName(res)!;
        const content = await buildCartEmail({customerKey, cartId, userId}, res);
        if (!content) {
            res.status(404).json({error: 'Cart not found'});
            return;
        }
        const message: SendMailProps = {
            from: {name: 'Chums B2B', address: 'automated@chums.com'},
            to: {name, address: email},
            subject: `Proposed Order: ${cartId}`,
            ...content
        }
        const result = await sendEmail(message)
        res.json({result});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("sendCartEmail()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in sendCartEmail'});
    }
}


export async function buildCartEmailData(arg: BuildCartEmailProps): Promise<EmailCart | null> {
    try {
        const {customerKey, cartId, userId} = arg;
        await syncFromC2({customerKey, cartId});
        const cart = await loadCart({cartId, userId});
        if (!cart) {
            return null;
        }
        const detail: EmailDetailLine[] = cart.detail.map(line => {
            const unitPrice = new Decimal(1).sub(new Decimal(line.lineDiscountPercent ?? 0).div(100)).times(new Decimal(line.unitPrice ?? 0).div(line.unitOfMeasureConvFactor ?? 1));
            const itemPrice = new Decimal(1).sub(new Decimal(line.lineDiscountPercent ?? 0).div(100)).times(line.unitPrice ?? 0);
            const {
                itemCode,
                itemType,
                itemCodeDesc,
                unitOfMeasure,
                quantityOrdered,
                lineDiscountPercent,
                commentText,
                extensionAmt
            } = line;
            return {
                itemCode,
                itemType,
                itemCodeDesc,
                image: line.cartProduct.image ?? null,
                unitOfMeasure: unitOfMeasure ?? 'N/A',
                quantityOrdered: line.itemType === '4' ? 0 : numeral(quantityOrdered).format('0,0'),
                unitPrice: line.itemType === '4' ? 'N/A' : numeral(unitPrice).format('0,0.00'),
                itemPrice: line.itemType === '4' ? 'N/A' : numeral(itemPrice).format('0,0.00'),
                hasDiscount: line.itemType === '4' ? false : new Decimal(lineDiscountPercent).gt(0),
                lineDiscountPercent: line.itemType === '4' ? 0 : numeral(lineDiscountPercent).format('0'),
                commentText,
                extensionAmt: line.itemType === '4' ? 0 : numeral(extensionAmt).format('0,0.00'),
                suggestedRetailPrice: line.itemType === '4'
                    ? 'N/A'
                    : (line.pricing.suggestedRetailPrice
                            ? numeral(line.pricing.suggestedRetailPrice).format('0,0.00')
                            : 'N/A'
                    )
            }
        })
        const itemCount = cart.detail
            .filter(line => line.itemType === '1')
            .map(line => new Decimal(line.quantityOrdered ?? 0).times(line.unitOfMeasureConvFactor ?? 1))
            .reduce((a, b) => a.add(b), new Decimal(0))
            .toNumber();
        cart.header.subTotalAmt = numeral(cart.header.subTotalAmt).format('0,0.00');
        return {
            header: cart.header,
            detail: detail,
            itemCount
        };
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("buildCartEmailData()", err.message, err.stack);
            return Promise.reject(err);
        }
        debug("buildCartEmailData()", err);
        return Promise.reject(new Error('Error in buildCartEmailData()'));
    }
}

export interface BuildCartEmailProps {
    customerKey: string;
    cartId: string;
    userId: number;
}

export async function buildCartEmail(arg: BuildCartEmailProps, res: Response): Promise<{
    html: string;
    textContent: string;
} | null> {
    try {
        const data = await buildCartEmailData(arg);
        if (!data) {
            return null;
        }
        const html = await renderCartEmailHTML(data, res);
        const textContent = renderCartEmailText(data);
        return {html, textContent};
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("buildCartEmail()", err.message);
            return Promise.reject(err);
        }
        debug("buildCartEmail()", err);
        return Promise.reject(new Error('Error in buildCartEmail()'));
    }
}


interface EmailCart {
    header: B2BCartHeader;
    detail: EmailDetailLine[];
    itemCount: number;
}

export async function renderCartEmailHTML(cart: EmailCart, res: Response): Promise<string> {
    return new Promise((resolve, reject) => {
        res.render('cart-email.pug', cart, (err, html) => {
            if (err) {
                return reject(err);
            }
            resolve(html);
        })
    })
}

export function renderCartEmailText(cart: EmailCart): string {
    const dateCreated = dayjs(cart.header.dateCreated).format('MM/DD/YYYY');
    const expires = cart.header.shipExpireDate ? dayjs(cart.header.shipExpireDate).format('MM/DD/YYYY') : 'N/A';
    const header = `
       CHUMS B2B - Proposed Order
       Account: ${cart.header.arDivisionNo}-${cart.header.customerNo}
       ${cart.header.customerName}
       
       Cart #: ${cart.header.id}
       Created: ${dateCreated}
       Cart Expires: ${expires}
       Cart Name: ${cart.header.customerPONo}
       `;
    const detail = cart.detail.map(line => `
        ${line.itemCode} ${line.itemCodeDesc} 
        qty: ${numeral(line.quantityOrdered).format('0,0')} ${line.unitOfMeasure}
        price: ${numeral(line.itemPrice).format('$ 0,0.00')}
        ext: ${numeral(line.extensionAmt).format('$ 0,0.00')}
        comment: ${line.commentText}    
        `);

    return `
        ${header}
        
        Line Detail
        -------------------
        ${detail.join('\n')}
        -------------------
        Total: ${numeral(cart.header.subTotalAmt).format('$ 0,0.00')}
    `

}
