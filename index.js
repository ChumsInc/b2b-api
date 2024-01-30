import 'dotenv/config.js'
import express from 'express';
import xFrameOptions from 'x-frame-options';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import {default as libRouter} from './lib/index.js'
import http from 'node:http';
import compression from 'compression';
import Debug from "debug";
import path from 'node:path'

process.env.DEBUG = 'chums:*,pm2:*';
const debug = Debug('chums:index');

const app = express();
app.use(helmet({
    xXssProtection: false,
}));
app.set('trust proxy', 'loopback');
app.use(compression());
app.use(xFrameOptions());
app.set('json spaces', 2);
app.set('view engine', 'pug');
app.set('views', path.join(process.cwd(), '/views'));

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//app.set('view options', {pretty: true});

app.use(express.static(path.join(process.cwd(), '/public')));
app.use('/css', express.static(path.join(process.cwd(), '/public/css')));
app.use('/js', express.static(path.join(process.cwd(), '/public/js')));
app.use('/jquery', express.static(path.join(process.cwd(), '/public/jquery')));
app.use('/images', express.static(path.join(process.cwd(), '/public/images')));
app.use('/modules', express.static(path.join(process.cwd(), '/node_modules')));

/**
 * Test for invalid URL
 *
 */
app.use((req, res, next) => {
    try {
        decodeURI(req.url);
        next();
    } catch (err) {
        res.status(404).json({error: err.message});
        console.log(err.message);
    }
});

app.use((req, res, next) => {
    res.locals.site = 'chums';
    res.locals.response = {};
    next();
}, libRouter);


app.get('/', function (req, res) {
    res.jsonp({
        response: 'hello world.',
    });
    res.end();
});

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
