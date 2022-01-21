const debug = require('debug')('chums:lib:preload');
const {loadCurrentMessages} = require('./site-messages/messages');
const {loadMenus} = require('./menus/menu');
const {loadSlides} = require('./features/slides');
const {load: loadKeywords} = require('./keywords');

const CHUMS_PRODUCTS_MENU = 2;
const BC_PRODUCTS_MENU = 118;
const PRODUCT_KEYWORD_TYPES = ['category', 'product'];

async function loadState() {
    try {
        const [slides, [menu_chums = {}], keywords, messages] = await Promise.all([
            loadSlides({all: false}),
            loadMenus({id: CHUMS_PRODUCTS_MENU}),
            loadKeywords(),
            loadCurrentMessages(),
        ]);
        return {slides, menu_chums, keywords, messages};
    } catch(err) {
        debug("loadState()", err.message);
        return Promise.reject(err);
    }

}

exports.state = async (req, res) => {
    try {
        const state = await loadState();
        res.json({...state});
    } catch(err) {
        debug("preloadState()", err.message);
        res.json({error: err.message});
    }
};

exports.preloadJS = async (req, res) => {
    try {
        const {slides, messages, keywords, menu_chums, menu_bc} = await loadState();
        const initialState = {
            app: {slides, messages, productMenu: menu_chums, productMenuBC: menu_bc, keywords},
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
        const js = 'window.__PRELOADED_STATE__ = ' + JSON.stringify(initialState, undefined, 2);
        res.set('Content-Type', 'application/javascript').send(js);
    } catch (err) {
        debug("preloadJS()", err.message);
        return Promise.reject(err);
    }
};
