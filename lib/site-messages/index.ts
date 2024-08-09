import {Request, Response} from "express";
import Debug from "debug";
import {deleteMessage, loadCurrentMessages, loadMessages, saveMessage} from './messages.js';

const debug = Debug('chums:lib:site-messages');

export const getMessages = async (req: Request, res: Response) => {
    try {
        const messages = await loadMessages();
        res.json({messages});
    } catch (err) {
        if (err instanceof Error) {
            debug("getMessages()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getMessages'});
    }
}

export const getMessage = async (req: Request, res: Response) => {
    try {
        const [message = null] = await loadMessages(req.params.id);
        if (!message) {
            return res.status(404).json({error: 'SiteMessage not found'});
        }
        res.json({message});
    } catch (err) {
        if (err instanceof Error) {
            debug("getMessages()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getMessages'});
    }
}

export const getCurrentMessages = async (req: Request, res: Response) => {
    try {
        const messages = await loadCurrentMessages();
        res.json({messages});
    } catch (err) {
        if (err instanceof Error) {
            debug("getCurrentMessages()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getCurrentMessages'});
    }
}

export const postMessage = async (req: Request, res: Response) => {
    try {
        const message = await saveMessage(req.body);
        res.json({message});
    } catch (err) {
        if (err instanceof Error) {
            debug("postMessage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postMessage'});
    }
}

export const delMessage = async (req: Request, res: Response) => {
    try {
        const [_message] = await loadMessages(req.params.id);
        if (!_message) {
            return res.status(404).json({error: 'SiteMessage not found'});
        }
        const messages = await deleteMessage(req.params.id);
        res.json({messages});
    } catch (err) {
        if (err instanceof Error) {
            debug("delMessage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delMessage'});
    }
}
