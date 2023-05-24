'use strict';
import {validateUser, validateRole} from 'chums-local-modules';
import {Router} from "express";



const router = Router();
import {getPages, postPage, delPage} from './page.js';
import {validateAdmin} from "../common.js";

router.get('/:id(\\d+)?', getPages);
router.get('/:keyword?', getPages);
router.post('/', validateUser, validateAdmin, postPage);
router.delete('/:id(\\d+)', validateUser, validateAdmin, delPage);

export default router;

