import {Router} from "express";
import Debug from "debug";
import {deleteMessage, loadCurrentMessages, loadMessages, saveMessage} from './messages.js';
import {validateAdmin} from "../common.js";
import {validateUser} from "chums-local-modules";

const router = Router();
const debug = Debug('chums:lib:site-messages');

export const getMessages = async (req, res) => {
    try {
        const messages = await loadMessages(req.params);
        res.json({messages});
    } catch(err) {
        if (err instanceof Error) {
            debug("getMessages()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getMessages'});
    }
}

export const getCurrentMessages = async (req, res) => {
    try {
        const messages = await loadCurrentMessages();
        res.json({messages});
    } catch(err) {
        if (err instanceof Error) {
            debug("getCurrentMessages()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getCurrentMessages'});
    }
}

export const postMessage = async (req, res) => {
    try {
        const messages = await saveMessage(req.body);
        res.json({messages});
    } catch(err) {
        if (err instanceof Error) {
            debug("postMessage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postMessage'});
    }
}

export const delMessage = async (req, res) => {
    try {
        const messages = await deleteMessage(req.params);
        res.json({messages});
    } catch(err) {
        if (err instanceof Error) {
            debug("delMessage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delMessage'});
    }
}

router.get('/:id(\\d+)?', getMessages);
router.get('/current', getCurrentMessages);
router.post('/:id(\\d+)?', validateUser, validateAdmin, postMessage,);
router.delete('/:id(\\d+)', validateUser, validateAdmin, delMessage);

export default router;
