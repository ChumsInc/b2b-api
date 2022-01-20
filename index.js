const dotenv  = require('dotenv').config();
if (dotenv.error) {
    console.log('*** error loading .env', dotenv.error);
    return;
}

const express = require('express');
const xFrameOptions = require('x-frame-options');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const http = require('http');
const compression = require('compression');
const helmet = require('helmet');
const debug = require('debug')('chums:index');

// local routing
const libRouter = require('./lib');

const app = express();
app.use(helmet());
app.set('trust proxy', 'loopback');
app.use(compression());
app.use(xFrameOptions());
app.set('json spaces', 2);
app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//app.set('view options', {pretty: true});

app.use(express.static(__dirname + '/public'));
app.use('/css', express.static(__dirname + '/public/css'));
app.use('/js', express.static(__dirname + '/public/js'));
app.use('/jquery', express.static(__dirname + '/public/jquery'));
app.use('/images', express.static(__dirname + '/public/images'));
app.use('/modules', express.static(__dirname + '/node_modules'));

/**
 * Test for invalid URL
 *
 */
app.use((req, res, next) => {
    try {
        decodeURI(req.url);
        next();
    } catch(err) {
        res.status(404).json({error: err.message});
        console.log(err.message);
    }
});

app.use((req, res, next) => {
    res.locals.site = 'chums';
    res.locals.response = {};
    next();
}, libRouter.router);


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
