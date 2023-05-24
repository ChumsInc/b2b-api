import {validateUser} from 'chums-local-modules';
import {validateAdmin} from '../../common.js';
import {Router} from "express";
import {
    delCategory,
    delCategoryItem,
    getCategories,
    getCategory,
    getCategoryItems,
    postCategory,
    postCategoryItem,
    postItemSort
} from './category.js';
import {
    delVariant,
    getProduct,
    getProductList,
    getVariant,
    getVariantsList,
    postProduct,
    postSetDefaultVariant,
    postVariant,
    postVariantSort
} from './product.js';
import {getProductItems} from './item.js';
import {delImage, getImage, getImages, postImage} from './images.js';
import {getSeasons, postSeason} from './seasons.js';
import {delMixItem, getMix, getSageBOM, postMix, postMixItems} from './mix.js';

const router = Router();


router.get('/category/list', getCategories);
router.get('/category/:id(\d+)', getCategory);
router.get('/category/:keyword([\w\-]+)', getCategory);
router.get('/category/:parentId(\d+)/items/:id(\d+)?', getCategoryItems);
router.get('/category/parent/:parentId(\d+)', getCategories);
router.post('/category/', validateUser, validateAdmin, postCategory);
router.post('/category/item', validateUser, validateAdmin, postCategoryItem);
router.post('/category/:parentId(\d+)/sort', validateUser, validateAdmin, postItemSort);
router.delete('/category/:id(\d+)', validateUser, validateAdmin, delCategory);
router.delete('/category/item/:id(\d+)', validateUser, validateAdmin, delCategoryItem);

router.get('/images/product/:productId(\\d+)', getImages);
router.get('/images/:id(\\d+)', getImage);
router.post('/images/', validateUser, validateAdmin, postImage);
router.put('/images/:id(\\d+)', validateUser, validateAdmin, postImage);
router.delete('/image/:productId(\\d+)/:id(\\d+)', validateUser, validateAdmin, delImage);


router.get('/id/:id(\\d+)', getProduct);
router.get('/keyword/:keyword', getProduct);
router.get('/items/:productId', getProductItems);
router.post('/:id(\\d+)', validateUser, validateAdmin, postProduct);
router.put('/:id(\\d+)', validateUser, validateAdmin, postProduct);

router.get('/list/:mfg(\\d+)', getProductList);
// router.get('/products/:keyword')

router.get('/mix/:productId(\\d+)', getMix);
router.get('/mix/:productId(\\d+)/bom', validateUser, validateAdmin, getSageBOM);
router.post('/mix/:productId(\\d+)/:mixID(\\d+)/items', validateUser, validateAdmin, postMixItems);
router.post('/mix/:productId(\\d+)', validateUser, validateAdmin, postMix);
router.put('/mix/:productId(\\d+)/:mixID(\\d+)', validateUser, validateAdmin, postMix);
router.delete('/mix/:productId(\\d+)/:mixID(\\d+)/:id(\\d+)', validateUser, validateAdmin, delMixItem);

router.get('/seasons/:id(\d+)?', getSeasons);
router.get('/seasons/:code', getSeasons);
router.post('/seasons/:id', validateUser, validateAdmin, postSeason);

router.get('/variants/:productId(\\d+)', getVariantsList)
router.get('/variants/:productId(\\d+)/:id(\\d+)', getVariant);
router.post('/variants/:productId(\\d+)', validateUser, validateAdmin, postVariant);
router.put('/variants/:productId(\\d+)/sort', validateUser, validateAdmin, postVariantSort);
router.put('/variants/:productId(\\d+)/:id(\\d+)', validateUser, validateAdmin, postVariant);
router.put('/variants/:productId(\\d+)/:id(\\d+)/default', validateUser, validateAdmin, postSetDefaultVariant);
router.delete('/variants/:productId(\\d+)/:id(\\d+)', validateUser, validateAdmin, delVariant);


export default router;
