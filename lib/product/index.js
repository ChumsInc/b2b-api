'use strict';
const debug = require('debug')('chums:lib:product');
const {validateUser, validateRole} = require('chums-local-modules');
const validateAdmin = [validateUser, validateRole(['webadmin', 'admin', 'product-admin'])];

const base = require('../base');
const express = require('express');
const router = express.Router();

const product = require('./product');
const mfg = require('./manufacturers');
const category = require('./category');
const materials = require('./materials');
const images = require('./v2/images');
const variant = require('./variant');
const colors = require('./v2/colors');
const items = require('./v2/item');
const mix = require('./mix');


const v2 = require('./v2');

const deprecationNotice = (req, res, next) => {
    debug(req.method, req.originalUrl, '<<< DEPRECATED', req.headers);
    next();
}

const allProperties = [
    deprecationNotice,
    product.get,
    variant.getProductVariants,
    product.getMixItems,
    // product.getItems,
    // product.getItemCodes,
    // product.getItemQty,
    product.getImages,
    product.getMaterials,
];

router.use('/v2', v2.router);



router.get('/category/:id(\\d+)?', category.getCategories);
router.get('/category/:keyword([\\w\-]+)', category.getCategories);
router.get('/category/:parentId(\\d+)/items/:id(\\d+)?', category.getCategoryItems);
router.get('/category/:keyword([\\w\-]+)/items/:id(\\d+)?', category.getCategoryItems);
router.get('/category/keyword/:keyword', [category.deprecated, category.getCategories]);
router.get('/category/keyword/:keyword/items', [category.deprecated, category.getCategoryItems]);
router.get('/category/parent/:parentId(\\d+)', category.getCategories);
router.post('/category/', validateAdmin, category.postCategory);
router.post('/category/item', validateAdmin, category.postCategoryItem);
router.post('/category/:parentId(\\d+)/sort', validateAdmin, category.postItemSort);
router.delete('/category/:id(\\d+)', validateAdmin, category.delCategory);
router.delete('/category/:parentId(\\d+)/item/:id(\\d+)', validateAdmin, category.deleteCategoryItem);

router.get('/materials/:id(\\d+)?', materials.getMaterials);
router.get('/materials/:id(\\d+)/products', materials.getMaterialProducts);
router.post('/materials/:id(\\d+)?', materials.postMaterial);

router.get('/images/product/:productId(\\d+)', images.getImages);
router.get('/images/:id(\\d+)', images.getImage);
router.post('/images/', images.postImage);
router.delete('/images/:productId(\\d+)/:id(\\d+)', images.delImage);

router.use('/variants', variant.router);
router.get('/colors/:id(\\d+)?', colors.getColors);
router.get('/colors/code/:code?', colors.getColors);
router.get('/colors/:id(\\d+)/items', colors.getItems);
router.get('/colors/:id(\\d+)/mix', colors.getMixItems);
router.post('/colors', colors.postColor);

router.get('/items/product/:productId(\\d+)', items.getItems);
router.get('/items/:id(\\d+)', items.getItems);
router.post('/items/:id(\\d+)', items.postItem);
router.delete('/items/:id(\\d+)/:productId(\\d+)', items.delItem);

router.use('/mix', mix.router);


router.get('/mfg/:id(\\d+)', mfg.get);
router.get('/mfg/all', mfg.get);

router.get('/id/:id(\\d+)', allProperties, base.send);
router.get('/keyword/:keyword', allProperties, base.send);
router.get('/all', [
    deprecationNotice,
    product.get,
    base.send
]);


router.post('/$', [
    deprecationNotice,
    validateAdmin,
    product.post,
    product.get,
    product.getVariants,
    product.getMixItems,
    // product.getItems,
    // product.getItemCodes,
    // product.getItemQty,
    product.getImages,
    base.send
]);

router.post('/:productID(\\d+)/defaultvariant/:variantID(\\d+)', [
    deprecationNotice,
    variant.postDefaultVariant,
    variant.getProduct,
]);

router.get('/list/:mfg?', validateAdmin, product.getList);

// router.get('/specials', user.requireAdmin, specials.get);
// router.get('/specials/:id(\\d+)', user.requireAdmin, specials.get);
// router.get('/specials/product/:productId(\\d+)', user.requireAdmin, specials.get);
// router.post('/specials', user.requireAdmin, specials.post);
// router.delete('/specials/:id(\\d+)', user.requireAdmin, specials.delete);

exports.router = router;
