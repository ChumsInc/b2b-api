import {HelmetOptions} from "helmet";
import {IncomingMessage, ServerResponse} from "node:http";
import {Response} from "express";

export const helmetOptions:Readonly<HelmetOptions> = {
    contentSecurityPolicy: {
        directives: {
            "img-src": [
                "'self'",
                "b2b.chums.com",
                "*.chums.com",
                "www.googletagmanager.com",
                "*.googleusercontent.com",
                "'unsafe-inline'",
            ],
            "frame-src": [
                "'self'",
                "accounts.google.com",
                "https://accounts.google.com/gsi/",
                "https://www.youtube.com/",
                "https://youtu.be/",
                "'unsafe-inline'",
            ],
            "style-src": [
                "'self'",
                "b2b.chums.com",
                "*.chums.com",
                "https://accounts.google.com/gsi/style",
                "https://fonts.googleapis.com",
                "'unsafe-inline'",
            ],
            "font-src": [
                "'self'",
                "https://fonts.gstatic.com",
                "'unsafe-inline'",
            ],
            "default-src": [
                "'self'",
                "'unsafe-inline'",
            ],
        },
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
    crossOriginOpenerPolicy: {
        policy: 'same-origin-allow-popups',
    }
}
