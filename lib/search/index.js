const express = require('express');
const router = express.Router();


const {getPages, getProduct, getProducts, sendResult} = require('./search-v2');
const {getSearch3} = require('./search-v3');

router.get('/v3/:term', getSearch3);
router.get('/:term/:limit(\\d+)', [getPages, getProduct, getProducts, sendResult]);

exports.router = router;
