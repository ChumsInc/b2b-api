import {validateUser} from 'chums-local-modules'
import {Router} from "express";
import {getColors, getItems, postColor} from './v2/colors.js';
import {default as v2Router} from './v2/index.js';
import {delProductItem, postProductItem} from "./v2/item.js";
import {validateAdmin} from "../common.js";
import {getWhereUsed} from "./where-used.js";

const router = Router();

router.use('/v2', v2Router);

router.get('/colors.json', getColors);
router.post('/colors.json', validateUser, validateAdmin, postColor);
router.get('/colors/:id/items.json', getItems);
router.get('/colors/:id.json', getColors);

router.post('/items/:productId/items.json', validateUser, validateAdmin, postProductItem);
router.put('/items/:productId/:id.json', validateUser, validateAdmin, postProductItem);
router.delete('/items/:productId/:id.json', validateUser, validateAdmin, delProductItem);

router.get('/where-used', getWhereUsed)

export default router;
