'use strict';
import {Router} from 'express';
import Debug from 'debug';
import {default as productRouter} from './product/index.js';
import {getKeywords} from './keywords/index.js';
import {default as pagesRouter} from './pages/index.js';
import {default as menuRouter} from './menus/index.js';
import {default as siteMessagesRouter} from './site-messages/index.js';
import {formattedState, preloadJS, state} from './preload.js';
import {postError} from './error-reporting/index.js';
import {getActiveSlides, getSlides} from "./features/slides.js";
import {getSearchPages, getSearchProduct, getSearchProducts, sendSearchResult} from "./search/search-v2.js";
import {getSearch3} from './search/search-v3.js'
import {deprecationNotice} from "./common.js";

const debug = Debug('chums:lib:index');
const router = Router();

router.use((req, res, next) => {
    debug(req.ip, req.method, req.originalUrl, req.get('referrer') || req.get('host'));
    next();
})

// used with B2B website
router.post('/error-reporting', postError);
// router.use('/features', features.router);
router.get('/features/slides/:id(\\d+)', getSlides);
router.get('/features/slides/active', getActiveSlides);
router.get('/keywords/:keyword?', getKeywords);
router.use('/menus', menuRouter);
router.use('/messages', siteMessagesRouter);
router.get('/preload/state/formatted', formattedState);
router.get('/preload/state.js', preloadJS);
router.get('/preload/state', state);
router.use('/products', productRouter);
router.get('/search/v3/:term', getSearch3);
router.get('/search/:term/:limit(\\d+)', [deprecationNotice, getSearchPages, getSearchProduct, getSearchProducts, sendSearchResult]);
router.use('/pages', pagesRouter);


export default router;

