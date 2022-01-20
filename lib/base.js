'use strict';
function send(req, res, next)  {
    if (res.locals.response === undefined) {
        res.locals.response = {};
    }

    if (res.locals.error) {
        res.locals.response = {...res.locals.error, ...res.locals.response};
    }

    res.json(res.locals.response);
    // next();
}

exports.send = send;

