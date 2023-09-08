import {validateUser} from 'chums-local-modules'
import {sendLocalsResponse} from "../base.js";
import {Router} from "express";
import {getProduct, getProductList, getProductMaterials, postProduct} from './product.js';
import {getManufacturers} from './manufacturers.js';
import {
    delCategory,
    deleteCategoryItem,
    deprecated,
    getCategories,
    getCategoryItems,
    getUsage,
    postCategory,
    postCategoryItem,
    postItemSort
} from './category.js';
import {getMaterialProducts, getMaterials, postMaterial} from './materials.js';
import {delImage, getImage, getImages, getImagesForProducts, postImage} from './v2/images.js';
import {
    delVariant,
    getProductVariants,
    getVariant,
    getVariantProduct,
    postDefaultVariant,
    postVariant
} from './variant.js';
import {getColors, getItems, getMixItems, postColor} from './v2/colors.js';
import {default as mixRouter, getProductMix} from './mix.js';
import {default as v2Router} from './v2/index.js';
import {delProductItem, getProductItems, postProductItem} from "./v2/item.js";
import {deprecationNotice, validateAdmin} from "../common.js";

const router = Router();

const allProperties = [
    deprecationNotice,
    getProduct,
    getProductVariants,
    getProductMix,
    getImagesForProducts,
    getProductMaterials,
];

router.use('/mix', deprecationNotice, mixRouter);
router.use('/v2', v2Router);

router.get('/category/:id(\\d+)?', getCategories);
router.get('/category/find/:keyword', getUsage);
router.get('/category/:keyword([\\w\-]+)', getCategories);
router.get('/category/:parentId(\\d+)/items/:id(\\d+)?', getCategoryItems);
router.get('/category/:keyword([\\w\-]+)/items/:id(\\d+)?', getCategoryItems);
router.get('/category/keyword/:keyword', [deprecated, getCategories]);
router.get('/category/keyword/:keyword/items', [deprecated, getCategoryItems]);
router.get('/category/parent/:parentId(\\d+)', getCategories);
router.post('/category/', validateUser, validateAdmin, postCategory);
router.post('/category/:id(\\d+)', validateUser, validateAdmin, postCategory);
router.post('/category/item', validateUser, validateAdmin, postCategoryItem);
router.post('/category/:parentId(\\d+)/sort', validateUser, validateAdmin, postItemSort);
router.delete('/category/:id(\\d+)', validateUser, validateAdmin, delCategory);
router.delete('/category/:parentId(\\d+)/item/:id(\\d+)', validateUser, validateAdmin, deleteCategoryItem);

router.get('/materials/:id(\\d+)?', getMaterials);
router.get('/materials/:id(\\d+)/products', getMaterialProducts);
router.post('/materials/:id(\\d+)?', postMaterial);

router.get('/images/product/:productId(\\d+)', getImages);
router.get('/images/:id(\\d+)', getImage);
router.post('/images/', validateUser, validateAdmin, postImage);
router.delete('/images/:productId(\\d+)/:id(\\d+)', validateUser, validateAdmin, delImage);


router.get('/colors/:id(\\d+)?', getColors);
router.get('/colors/code/:code?', getColors);
router.get('/colors/:id(\\d+)/items', getItems);
router.get('/colors/:id(\\d+)/mix', getMixItems);
router.post('/colors', validateUser, validateAdmin, postColor);

router.get('/items/product/:productId(\\d+)', getProductItems);
router.get('/items/:id(\\d+)', getProductItems);
router.post('/items/:productId(\\d+)', validateUser, validateAdmin, postProductItem);
router.put('/items/:productId(\\d+)/:id(\\d+)', validateUser, validateAdmin, postProductItem);
router.delete('/items/:productId(\\d+)/:id(\\d+)', validateUser, validateAdmin, delProductItem);

router.get('/mfg/:id(\\d+)', getManufacturers);
router.get('/mfg/all', getManufacturers);

router.get('/id/:id(\\d+)', allProperties, sendLocalsResponse);
router.get('/keyword/:keyword', allProperties, sendLocalsResponse);

router.get('/variants/:id(\\d+)$', getVariant);
router.get('/variants//product/:productID(\\d+)$', deprecationNotice, getVariantProduct);
router.delete('/variants/:id', validateUser, validateAdmin, deprecationNotice, delVariant);
router.post('/variants', validateUser, validateAdmin, deprecationNotice, postVariant);


router.get('/all', [
    deprecationNotice,
    getProduct,
    sendLocalsResponse
]);


router.post('/$', [
    deprecationNotice,
    validateUser,
    validateAdmin,
    postProduct,
    getProduct,
    getProductVariants,
    getProductMix,
    // product.getItems,
    // product.getItemCodes,
    // product.getItemQty,
    getImagesForProducts,
    sendLocalsResponse
]);

router.post('/:productID(\\d+)/defaultvariant/:variantID(\\d+)', [
    deprecationNotice,
    validateUser,
    validateAdmin,
    postDefaultVariant,
    getVariantProduct,
]);

router.get('/list/:mfg?', validateUser, validateAdmin, getProductList);

// router.get('/specials', user.requireAdmin, specials.get);
// router.get('/specials/:id(\\d+)', user.requireAdmin, specials.get);
// router.get('/specials/product/:productId(\\d+)', user.requireAdmin, specials.get);
// router.post('/specials', user.requireAdmin, specials.post);
// router.delete('/specials/:id(\\d+)', user.requireAdmin, specials.delete);

export default router;
