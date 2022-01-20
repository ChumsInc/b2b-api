'use strict';
const {validateUser, validateRole} = require('chums-local-modules');
const validateAdmin = [validateUser, validateRole(['webadmin', 'admin', 'product-admin'])];


const router = require('express').Router();
const menu = require('./menu');

router.get('/:id(\\d+)?', menu.getMenus);
router.get('/:parentId(\\d+)/:id(\\d+)?', menu.getMenuItems);
router.get('/parents/:id(\\d+)?', menu.getParents);
router.post('/', validateAdmin, menu.postMenu);
router.post('/item', validateAdmin, menu.postMenuItem);
router.post('/:parentId(\\d+)/sort', validateAdmin, menu.postItemSort);
router.delete('/:id(\\d+)', validateAdmin, menu.delMenu);
router.delete('/:parentId(\\d+)/:id(\\d+)', validateAdmin, menu.delMenuItem);

exports.router = router;

