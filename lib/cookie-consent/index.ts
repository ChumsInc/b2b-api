import {Request, Response} from "express";
import {CookieConsentInfo} from 'chums-types'

const cookieConsentInfo:CookieConsentInfo = {
    'functional': {
        title: 'Functional (required)',
        required: true,
        description: 'These cookies are required for the site to function properly and includes capabilities such as ' +
            'logging in, adding items to a cart.',
        cookies: [
            'Local Browser Storage - We store a token that we use for authenticating actions that you make on the site, such as ' +
            'logging in, adding items to a cart, and completing your order. This storage is cleared when you log out.',
        ]
    },
    'preferences': {
        title: 'Personalization',
        required: false,
        description: 'These cookies store actions about how your personalize this site',
        cookies: [
            'Local Browser Storage - We store settings in your browser to help your settings be retained for your next visit. ' +
            'This includes settings such as recent customers accounts, any current filters, etc. If you use a shared ' +
            'browser then you might not want to enable this setting.'
        ]
    },
    'analytics': {
        title: 'Analytics and Performance',
        required: false,
        description: 'These cookies help us to understand how your use the site, to measure performance, and determine ' +
            'which pages are most relevant.',
        cookies: [
            'Google Analytics - GA is used to analyze each page you visit, which products you view and how you interact your ' +
            'cart, including information such as screen size, an estimate of your location, how often you return this site, ' +
            'and how long you are engaged on the site. We do not send any personally identifiable information to GA.',
            'Error Reporting - If you encounter an error on this site, we log the event to our error reporting ' +
            'system for further analysis. If you disable this cookie, the information will be anonymous. Error logs are ' +
            'not sent to outside parties.',
        ]
    },
    'marketing': {
        title: 'Marketing',
        required: false,
        description: 'Some pages include links to Youtube videos that highlight usage and lifestyle of our products. ' +
            'These links may be considered marketing in your area.',
        cookies: [
            'YouTube - Google stores cookies regarding these videos. If you opt out of these cookies we use a ' +
            'cookie-free link to the video.'
        ]
    },
};

export const getCookieConsentInfo = (req:Request, res:Response):void => {
    res.json(cookieConsentInfo);
}
