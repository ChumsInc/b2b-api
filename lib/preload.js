import Debug from "debug";
import {loadCurrentMessages} from './site-messages/messages.js';
import {loadMenus} from './menus/menu.js';
import {loadSlides} from './features/slides.js';
import {loadKeywords} from './keywords/index.js';
import {loadCurrentPromoCode, loadPromoCodes} from "./promo-codes/index.js";
import {loadCategory} from "./product/v2/category.js";
import {loadProduct} from "./product/v2/product.js";
import {loadPage} from "./pages/page.js";
import {loadBanners} from "./features/banners.js";

const debug = Debug('chums:lib:preload');

const CHUMS_PRODUCTS_MENU = 2;
const RESOURCES_MENU = 122;
const PRODUCT_KEYWORD_TYPES = ['category', 'product'];

async function loadState(options = {}) {
    try {
        const [
            slides,
            [menu_chums = {}],
            keywords,
            messages,
            promo_code,
            promo_codes,
            category,
            product,
            page,
            [menu_resources = {}],
            banners
        ] = await Promise.all([
            loadSlides({all: false}),
            loadMenus(CHUMS_PRODUCTS_MENU),
            loadKeywords({active: true}),
            loadCurrentMessages(),
            loadCurrentPromoCode(),
            loadPromoCodes({valid: true}),
            loadCategory({keyword: options.category}),
            loadProduct({keyword: options.product, complete: true}),
            loadPage({keyword: options.page}),
            loadMenus(RESOURCES_MENU),
            loadBanners({active: true}),
        ]);
        return {slides, menu_chums, keywords, messages, promo_code, promo_codes, category, product, page, menu_resources, banners};
    } catch (err) {
        debug("loadState()", err.message);
        return Promise.reject(err);
    }

}

const stateOptions = (req) => {
    return {
        category: req.query.category ?? undefined,
        product: req.query.product ?? undefined,
        page: req.query.page ?? undefined,
    }
}

export const state = async (req, res) => {
    try {
        const state = await loadState(stateOptions(req));
        res.json({...state});
    } catch (err) {
        debug("preloadState()", err.message);
        res.json({error: err.message});
    }
};

const mapState = ({slides, messages, keywords, menu_chums, promo_code, promo_codes, category, product, page, menu_resources, banners}) => {
    return {
        app: {slides, messages, productMenu: menu_chums, keywords},
        keywords: {
            list: keywords,
            loading: false,
        },
        category: {
            keywords: keywords.filter(kw => kw.pagetype === 'category'),
            content: category ?? null,
        },
        products: {
            keywords: keywords.filter(kw => PRODUCT_KEYWORD_TYPES.includes(kw.pagetype)),
            product: product ?? {},
        },
        promo_code: {
            promo_code: promo_code ?? null,
            promo_codes: promo_codes ?? [],
        },
        promoCodes: {
            current: promo_code ?? null,
            list: promo_codes ?? [],
        },
        page: {
            list: keywords.filter(kw => kw.pagetype === 'page'),
            content: page ?? null,
        },
        slides: {
            list: slides,
            loaded: true,
        },
        menu: {
            productMenu: menu_chums,
            resourcesMenu: menu_resources,
            loaded: true,
        },
        messages: {
            list: messages,
        },
        banners: {
            list: banners,
        }
    };
}

export const formattedState = async (req, res) => {
    try {
        const options = stateOptions(req);
        const _state = await loadState(options);
        const initialState = mapState(_state);
        res.json({...initialState});
    } catch (err) {
        debug("formattedState()", err.message);
        return Promise.reject(err);
    }
}

export const preloadJS = async (req, res) => {
    try {
        const _state = await loadState(stateOptions(req));
        const initialState = mapState(_state);
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify(initialState, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    } catch (err) {
        debug("preloadJS()", err.message);
        return Promise.reject(err);
    }
};
