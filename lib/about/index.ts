import {readFile, stat} from 'node:fs/promises';
import {Request, Response} from 'express';
import Debug from 'debug';

const debug = Debug('chums:lib:about');
export interface PackageJSON {
    name: string;
    version: string;
}

export const aboutAPI = async (req:Request, res:Response) => {
    try {
        let version = '0.0.0';
        try {
            const contents = await readFile('./package.json');
            if (contents) {
                const json:PackageJSON = JSON.parse(contents.toString());
                version = json?.version ?? 'unknown version';
            }
        } catch(err:unknown) {
            if (err instanceof Error) {
                version = err.message;
            } else {
                version = 'error in aboutAPI'
            }
        }
        res.json({site: '/api', version});
    } catch(err) {
        if (err instanceof Error) {
            debug("aboutAPI()", err.message);
            return Promise.reject(err);
        }
        debug("aboutAPI()", err);
        return Promise.reject(new Error('Error in aboutAPI()'));
    }
}
