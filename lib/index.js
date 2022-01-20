'use strict';
process.env.DEBUG = 'chums:*,pm2:*';
const express = require('express');
const debug = require('debug')('chums:lib:index');
const router = express.Router();

router.use((req, res, next) => {
    debug(req.ip, req.method, req.originalUrl, req.get('referrer') || req.get('host'));
    next();
})

const product = require('./product');
const keywords = require('./keywords');
const pages = require('./pages');
const menus = require('./menus');
const features = require('./features');
const search = require('./search');
const siteMessages = require('./site-messages');
const preload = require('./preload');
const errorReporting = require('./error-reporting');

// used with B2B website
router.post('/error-reporting', errorReporting.post);
router.use('/features', features.router);
router.use('/keywords', keywords.router);
router.use('/menus', menus.router);
router.use('/messages', siteMessages.router);
router.use('/preload/state', preload.state);
router.use('/preload/state.js', preload.preloadJS);
router.use('/products', product.router);
router.use('/search', search.router);
router.use('/pages', pages.router);


exports.router = router;

