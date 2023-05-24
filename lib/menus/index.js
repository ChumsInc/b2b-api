'use strict';
import {validateUser} from 'chums-local-modules';
import {Router} from "express";
import {
    delMenu,
    delMenuItem,
    getMenuItems,
    getMenus,
    getParents,
    postItemSort,
    postMenu,
    postMenuItem
} from './menu.js';
import {validateAdmin} from "../common.js";


const router = Router();

router.get('/:id(\\d+)?', getMenus);
router.get('/:parentId(\\d+)/:id(\\d+)?', getMenuItems);
router.get('/parents/:id(\\d+)?', getParents);
router.post('/item', validateUser, validateAdmin, postMenuItem);
router.post('/:parentId(\\d+)/sort', validateUser, validateAdmin, postItemSort);
router.post('/', validateUser, validateAdmin, postMenu);
router.delete('/:id(\\d+)', validateUser, validateAdmin, delMenu);
router.delete('/:parentId(\\d+)/:id(\\d+)', validateUser, validateAdmin, delMenuItem);

export default router;

