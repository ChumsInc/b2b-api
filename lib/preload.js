import Debug from "debug";
const debug = Debug('chums:lib:preload');
import {loadCurrentMessages} from './site-messages/messages.js';
import {loadMenus} from './menus/menu.js';
import {loadSlides} from './features/slides.js';
import {loadKeywords} from './keywords/index.js';

const CHUMS_PRODUCTS_MENU = 2;
const PRODUCT_KEYWORD_TYPES = ['category', 'product'];

async function loadState() {
    try {
        const [slides, [menu_chums = {}], keywords, messages] = await Promise.all([
            loadSlides({all: false}),
            loadMenus(CHUMS_PRODUCTS_MENU),
            loadKeywords({active: true}),
            loadCurrentMessages(),
        ]);
        return {slides, menu_chums, keywords, messages};
    } catch(err) {
        debug("loadState()", err.message);
        return Promise.reject(err);
    }

}

export const state = async (req, res) => {
    try {
        const state = await loadState();
        res.json({...state});
    } catch(err) {
        debug("preloadState()", err.message);
        res.json({error: err.message});
    }
};

const mapState = ({slides, messages, keywords, menu_chums}) => {
    return {
        app: {slides, messages, productMenu: menu_chums, keywords},
        keywords: {
            list: keywords,
            loading: false,
        },
        category: {
            keywords: keywords.filter(kw => kw.pagetype === 'category'),
        },
        products: {
            keywords: keywords.filter(kw => PRODUCT_KEYWORD_TYPES.includes(kw.pagetype)),
        },
        page: {
            list: keywords.filter(kw => kw.pagetype === 'page'),
        },
        slides: {
            list: slides,
            loaded: true,
        },
        menu: {
            productMenu: menu_chums,
            loaded: true,
        },
        messages: {
            list: messages,
        }
    };
}

export const formattedState = async (req, res) => {
    try {
        const {slides, messages, keywords, menu_chums} = await loadState();
        const initialState = mapState({slides, messages, keywords, menu_chums});
        res.json({...initialState});

    } catch(err) {
        debug("formattedState()", err.message);
        return Promise.reject(err);
    }
}

export const preloadJS = async (req, res) => {
    try {
        const {slides, messages, keywords, menu_chums} = await loadState();
        const initialState = mapState({slides, messages, keywords, menu_chums});
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify(initialState, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    } catch (err) {
        debug("preloadJS()", err.message);
        return Promise.reject(err);
    }
};
