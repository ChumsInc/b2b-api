'use strict';
const {validateUser, validateRole} = require('chums-local-modules');
const validateAdmin = [validateUser, validateRole(['webadmin', 'admin', 'product-admin'])];


const router = require('express').Router();
const page = require('./page');

router.get('/:id(\\d+)?', page.getPages);
router.get('/:keyword?', page.getPages);
router.post('/', validateAdmin, page.postPage);
router.delete('/:id(\\d+)', validateAdmin, page.delPage);

exports.router = router;

