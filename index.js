import 'dotenv/config.js'
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import http from 'node:http';
import Debug from "debug";
import {default as libRouter} from './lib/index.js'
import {helmetOptions} from "./helmetOptions.js";

process.env.DEBUG = 'chums:*,pm2:*';
const debug = Debug('chums:index');

const app = express();
app.use(helmet(helmetOptions));
app.set('trust proxy', 'loopback');
app.set('json spaces', 2);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use((req, res, next) => {
    res.locals.response = {};
    next();
})
app.use(libRouter);

app.use((req, res) => {
    if (!res.headersSent) {
        debug('404 Not Found:', req.ip, req.originalUrl);
        res.status(404).send({error: 404, message: 'Sorry, that page does not exist'});
    }
});


const {PORT, NODE_ENV} = process.env;
const server = http.createServer(app);
server.listen(PORT);
debug(`server started on port: ${PORT}; mode: ${NODE_ENV}`);
