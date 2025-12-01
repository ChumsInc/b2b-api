import Debug from "debug";
import { loadKeywords } from "../keywords/index.js";
import { loadCategory } from "../product/v2/category.js";
import { loadPage, loadPageContent } from "../pages/page.js";
import { loadProduct } from "../product/v2/product.js";
import { defaultCartItem, defaultVariant, getImageItemCode, getPrice, getSalesUM, hasVariants, parsePossiblyMissingFilename } from "../product/v2/utils.js";
import { loadMenu } from "../menus/menu.js";
import { loadCurrentMessages } from "../site-messages/messages.js";
import { loadBanners } from "../features/banners.js";
import { consentCookieName, loadCookieConsent } from "cookie-consent";
const debug = Debug('chums:lib:preloaded-state:v2');
const productMenuId = process.env.PRODUCT_MENU_ID ?? 2;
const resourcesMenuId = process.env.RESOURCES_MENU_ID ?? 122;
const getEmptyState = () => ({
    app: {
        nonce: null,
    },
    banners: {
        list: [],
        loading: false,
        loaded: false,
        updated: 0,
    },
    category: {
        keyword: null,
        category: null,
        status: 'idle'
    },
    cookieConsent: {
        status: 'idle',
        record: null,
        dismissed: false,
        details: null,
    },
    keywords: {
        list: [],
        loading: false,
        loaded: false,
    },
    menu: {
        productMenu: null,
        productMenuStatus: 'idle',
        resourcesMenu: null,
        resourcesMenuStatus: 'idle',
        isOpen: false,
    },
    messages: {
        list: [],
        loading: false,
        loaded: 0,
    },
    page: {
        list: [],
        keyword: null,
        status: 'idle',
        loaded: false,
        content: null,
        html: null,
    },
    products: {
        keyword: null,
        product: null,
        selectedProduct: null,
        image: {
            filename: null,
            itemCode: null,
        },
        colorCode: '',
        variantId: null,
        loading: false,
        msrp: [],
        customerPrice: [],
        salesUM: null,
        cartItem: null,
        pricing: [],
        customerKey: null,
        selectedItemCode: null,
    },
    version: {
        versionNo: null,
        loading: false,
        changed: false,
        ignored: null,
        lastChecked: 0,
    },
});
export async function buildPreloadedState({ keyword, uuid, sku }) {
    try {
        const keywords = await loadKeywords({ includeInactive: false });
        const productMenu = await loadMenu(productMenuId);
        const resourcesMenu = await loadMenu(resourcesMenuId);
        const messages = await loadCurrentMessages();
        const banners = await loadBanners({ active: true });
        const currentKeyword = keywords.find(kw => kw.keyword === keyword) ?? null;
        const state = { ...getEmptyState(), };
        state.keywords.list = keywords;
        state.keywords.loaded = true;
        state.page.list = keywords.filter(kw => kw.pagetype === 'page');
        state.menu.productMenu = productMenu;
        state.menu.resourcesMenu = resourcesMenu;
        state.messages.list = messages;
        state.messages.loaded = new Date().valueOf();
        state.banners.list = banners;
        state.banners.loaded = true;
        if (currentKeyword?.pagetype === 'page') {
            const page = await loadPage({ keyword: currentKeyword?.keyword });
            state.page.keyword = page?.keyword ?? null;
            state.page.content = page ?? null;
            if (page?.filename) {
                state.page.html = await loadPageContent(page.filename);
            }
        }
        if (currentKeyword?.pagetype === 'category') {
            const category = await loadCategory({ keyword: currentKeyword?.keyword });
            state.category.category = category;
            state.category.keyword = category?.keyword ?? null;
        }
        if (currentKeyword?.pagetype === 'product') {
            const product = await loadProduct({ keyword: currentKeyword?.keyword, complete: true });
            const variant = hasVariants(product ?? null) ? defaultVariant(product, sku) : null;
            state.products.product = product ?? null;
            state.products.keyword = product?.keyword ?? null;
            state.products.selectedProduct = variant?.product ?? product ?? null;
            state.products.variantId = variant?.id ?? null;
            state.products.msrp = getPrice(variant?.product ?? product ?? null);
            state.products.customerPrice = state.products.msrp;
            state.products.salesUM = getSalesUM(variant?.product ?? product ?? null);
            state.products.cartItem = defaultCartItem(variant?.product ?? product ?? null, { itemCode: sku });
            state.products.colorCode = state.products.cartItem?.colorCode
                ?? variant?.product?.defaultColor
                ?? product?.defaultColor
                ?? '';
            state.products.image = {
                filename: parsePossiblyMissingFilename(state.products.cartItem?.image ?? state.products.selectedProduct?.image ?? ''),
                itemCode: getImageItemCode(state.products.selectedProduct ?? state.products.product, state.products.colorCode)
                    ?? state.products.cartItem?.itemCode ?? null,
            };
        }
        if (uuid) {
            state.cookieConsent.record = await loadCookieConsent({ uuid: uuid });
        }
        return state;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("buildPreloadedState()", err.message);
            return Promise.reject(err);
        }
        debug("buildPreloadedState()", err);
        return Promise.reject(new Error('Error in buildPreloadedState()'));
    }
}
export const getPreloadedStateV2 = async (req, res) => {
    try {
        const params = {
            keyword: req.query.keyword ?? null,
            uuid: req.query.uuid ?? req.signedCookies[consentCookieName] ?? res.locals.uuid ?? null,
            sku: req.query.sku ?? null,
        };
        const state = await buildPreloadedState(params);
        res.json(state);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getPreloadedStateV2()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getPreloadedStateV2' });
    }
};
export const getPreloadedStateV2js = async (req, res) => {
    try {
        const params = {
            keyword: req.query.keyword ?? null,
            uuid: req.query.uuid ?? req.signedCookies[consentCookieName] ?? res.locals.uuid ?? null,
            sku: req.query.sku ?? null,
        };
        const state = await buildPreloadedState(params);
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify(state, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getPreloadedStateV2js()", err.message);
        }
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify({}, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    }
};
