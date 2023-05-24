'use strict';
import {validateUser} from 'chums-local-modules';
import {Router} from "express";
import {delPage, getPages, postPage} from './page.js';
import {validateAdmin} from "../common.js";


const router = Router();

router.get('/:id(\\d+)?', getPages);
router.get('/:keyword?', getPages);
router.post('/', validateUser, validateAdmin, postPage);
router.delete('/:id(\\d+)', validateUser, validateAdmin, delPage);

export default router;

