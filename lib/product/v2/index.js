const {validateUser, validateRole} = require('chums-local-modules');
const validateAdmin = [validateUser, validateRole(['webadmin', 'admin', 'product-admin'])];

const router = require('express').Router();
const category = require('./category');
const product = require('./product');
const items = require('./item');
const images = require('./images');
const season = require('./seasons');

router.get('/category/:id(\d+)', category.getCategory);
router.get('/category/:keyword([\w\-]+)', category.getCategory);
router.get('/category/:parentId(\d+)/items/:id(\d+)?', category.getCategoryItems);
router.get('/category/parent/:parentId(\d+)', category.getCategories);
router.post('/category/', validateAdmin, category.postCategory);
router.post('/category/item', validateAdmin, category.postCategoryItem);
router.post('/category/:parentId(\d+)/sort', validateAdmin, category.postItemSort);
router.delete('/category/:id(\d+)', validateAdmin, category.deleteCategory);
router.delete('/category/item/:id(\d+)', validateAdmin, category.deleteCategoryItem);

router.get('/images/product/:productId(\\d+)', images.getImages);
router.get('/images/:id(\\d+)', images.getImage);
router.post('/images/', images.postImage);
router.delete('/image/:productId(\\d+)/:id(\\d+)', images.delImage);


router.get('/id/:id(\\d+)', product.getByID);
router.get('/keyword/:keyword', product.getByID);
router.get('/items/:productId', items.getItems);
router.post('/:id(\\d+)', product.post)
// router.get('/products/:keyword')

router.get('/seasons/:id(\d+)?', season.getSeasons);
router.get('/seasons/:code', season.getSeasons);
router.post('/seasons/:id', season.postSeason);

exports.router = router;
