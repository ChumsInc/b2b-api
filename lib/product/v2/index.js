const {validateUser, validateRole} = require('chums-local-modules');
const validateAdmin = [validateUser, validateRole(['webadmin', 'admin', 'product-admin'])];

const router = require('express').Router();
const {
    getCategories,
    getCategory,
    getCategoryItems,
    postCategory,
    postCategoryItem,
    postItemSort,
    delCategoryItem,
    delCategory
} = require('./category');
const {
    getProduct,
    getProductList,
    postProduct,
    getVariantsList,
    getVariant,
    postVariant,
    delVariant, postVariantSort, postSetDefaultVariant
} = require('./product');
const {getProductItems, postProductItem, delProductItem} = require('./item');
const {getImage, getImages, postImage, delImage} = require('./images');
const {getSeasons, postSeason} = require('./seasons');
const {getMix, getSageBOM, postMixItems, postMix, delMixItem} = require('./mix');


router.get('/category/list', getCategories);
router.get('/category/:id(\d+)', getCategory);
router.get('/category/:keyword([\w\-]+)', getCategory);
router.get('/category/:parentId(\d+)/items/:id(\d+)?', getCategoryItems);
router.get('/category/parent/:parentId(\d+)', getCategories);
router.post('/category/', validateAdmin, postCategory);
router.post('/category/item', validateAdmin, postCategoryItem);
router.post('/category/:parentId(\d+)/sort', validateAdmin, postItemSort);
router.delete('/category/:id(\d+)', validateAdmin, delCategory);
router.delete('/category/item/:id(\d+)', validateAdmin, delCategoryItem);

router.get('/images/product/:productId(\\d+)', getImages);
router.get('/images/:id(\\d+)', getImage);
router.post('/images/', postImage);
router.put('/images/:id(\\d+)', postImage);
router.delete('/image/:productId(\\d+)/:id(\\d+)', delImage);


router.get('/id/:id(\\d+)', getProduct);
router.get('/keyword/:keyword', getProduct);
router.get('/items/:productId', getProductItems);
router.post('/:id(\\d+)', postProduct);
router.put('/:id(\\d+)', postProduct);

router.get('/list/:mfg(\\d+)', getProductList);
// router.get('/products/:keyword')

router.get('/mix/:productId(\\d+)', getMix);
router.get('/mix/:productId(\\d+)/bom', getSageBOM);
router.post('/mix/:productId(\\d+)/:mixID(\\d+)/items', postMixItems);
router.post('/mix/:productId(\\d+)', postMix);
router.put('/mix/:productId(\\d+)/:mixID(\\d+)', postMix);
router.delete('/mix/:productId(\\d+)/:mixID(\\d+)/:id(\\d+)', delMixItem);

router.get('/seasons/:id(\d+)?', getSeasons);
router.get('/seasons/:code', getSeasons);
router.post('/seasons/:id', postSeason);

router.get('/variants/:productId(\\d+)', getVariantsList)
router.get('/variants/:productId(\\d+)/:id(\\d+)', getVariant);
router.post('/variants/:productId(\\d+)', postVariant);
router.put('/variants/:productId(\\d+)/sort', postVariantSort);
router.put('/variants/:productId(\\d+)/:id(\\d+)', postVariant);
router.put('/variants/:productId(\\d+)/:id(\\d+)/default', postSetDefaultVariant);
router.delete('/variants/:productId(\\d+)/:id(\\d+)', delVariant);


exports.router = router;
