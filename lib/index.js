'use strict';
import {Router} from 'express';
import Debug from 'debug';
import {default as productRouter} from './product/index.js';
import {getKeywords} from './keywords/index.js';
import {delPage, getPages, postPage, getPage} from './pages/index.js';
import {default as menuRouter} from './menus/index.js';
import {delMessage, getCurrentMessages, getMessage, getMessages, postMessage} from './site-messages/index.js';
import {formattedState, preloadJS, state} from './preload.js';
import {getErrors, postError} from './error-reporting/index.js';
import {getActiveSlides, getSlides} from "./features/slides.js";
import {getSearchPages, getSearchProduct, getSearchProducts, sendSearchResult} from "./search/search-v2.js";
import {getSearch3} from './search/search-v3.js'
import {deprecationNotice, validateAdmin} from "./common.js";
import {getItemSearch} from "./search/item-search.js";
import {delBanner, getActiveBanners, getBanners, postBanner} from "./features/banners.js";
import {validateUser} from "chums-local-modules";
import {aboutAPI} from "./about/index.js";
import cartsRouter from "./carts/index.js";

const debug = Debug('chums:lib:index');
const router = Router();

const isLocalHost = (ip) => {
    return ip === '::ffff:127.0.0.1' || ip === '127.0.0.1';
}

const debugLogger = (req, res, next) => {
    if (!isLocalHost(req.ip)) {
        debug(req.ip, req.method, req.originalUrl, req.get('referrer') || req.get('host'));
    }
    next();
}

router.use(debugLogger);

router.get('/about.json', aboutAPI);
router.use('/carts', cartsRouter);

// used with B2B website
router.post('/error-reporting', postError);
router.get('/error-reporting.json', getErrors);
// router.use('/features', features.router);
router.get('/features/slides/:id(\\d+)', getSlides);
router.get('/features/slides/active', getActiveSlides);
router.get('/features/banners/active', getActiveBanners);
router.get('/features/banners/:id(\\d+)', validateUser, validateAdmin, getBanners);
router.get('/features/banners/all', validateUser, validateAdmin, getBanners);
router.post('/features/banners', validateUser, validateAdmin, postBanner);
router.put('/features/banners/:id(\\d+)', validateUser, validateAdmin, postBanner);
router.delete('/features/banners/:id(\\d+)', validateUser, validateAdmin, delBanner);
router.get('/keywords/:keyword?', getKeywords);
router.use('/menus', menuRouter);
router.get('/messages.json', getCurrentMessages);
router.get('/messages/current', deprecationNotice, getCurrentMessages);
router.get('/messages/list.json', validateUser, validateAdmin, getMessages);
router.get('/messages/:id.json', validateUser, validateAdmin, getMessage);
router.post('/messages.json', validateUser, validateAdmin, postMessage);
router.put('/messages/:id(\\d+).json', validateUser, validateAdmin, postMessage);
router.delete('/messages/:id(\\d+).json', validateUser, validateAdmin, delMessage);

router.get('/preload/state/formatted', formattedState);
router.get('/preload/state.json', formattedState);
router.get('/preload/state.js', preloadJS);
router.get('/preload/state', state);
router.use('/products', productRouter);
router.get('/search/v3/:term', getSearch3);
router.get('/search/items/:term', getItemSearch);
router.get('/search/:term/:limit(\\d+)', [deprecationNotice, getSearchPages, getSearchProduct, getSearchProducts, sendSearchResult]);
router.get('/pages.json', getPages);
router.get('/pages/:id(\\d+).json', getPage);
router.get('/pages/:keyword.json', getPage);
router.get('/pages/:id(\\d+)?', getPages);
router.get('/pages/:keyword?', getPages);
router.post('/pages/', validateUser, validateAdmin, postPage);
router.put('/pages/:id(\\d+).json', validateUser, validateAdmin, postPage);
router.delete('/pages/:id(\\d+)', validateUser, validateAdmin, delPage);


export default router;

