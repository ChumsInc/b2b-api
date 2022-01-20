const router = require('express').Router();
const debug = require('debug')('chums:lib:site-messages');
const {loadMessages, loadCurrentMessages, saveMessage, deleteMessage} = require('./messages');

router.get('/:id(\\d+)?', (req, res) => {
    loadMessages(req.params)
        .then(messages => {
            res.json({messages});
        })
        .catch(err => {
            debug('get()', {message: err.message, name: err.name});
            res.json({error: err.message, name: err.message});
        });
});

router.get('/current', (req, res) => {
    loadCurrentMessages(req.params)
        .then(messages => {
            res.json({messages});
        })
        .catch(err => {
            debug('get()', {message: err.message, name: err.name});
            res.json({error: err.message, name: err.message});
        });
});

router.post('/:id(\\d+)?', (req, res) => {
    saveMessage(req.body)
        .then(messages => {
            res.json({messages});
        })
        .catch(err => {
            debug('get()', {message: err.message, name: err.name});
            res.json({error: err.message, name: err.message});
        });
});

router.delete('/:id(\\d+)', (req, res) => {
    deleteMessage(req.params)
        .then(messages => {
            res.json({messages});
        })
        .catch(err => {
            debug('get()', {message: err.message, name: err.name});
            res.json({error: err.message, name: err.message});
        });
});

exports.router = router;
