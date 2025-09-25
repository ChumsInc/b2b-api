import { readFile } from 'node:fs/promises';
import Debug from 'debug';
const debug = Debug('chums:lib:about');
export const aboutAPI = async (req, res) => {
    try {
        let version = '0.0.0';
        try {
            const contents = await readFile('./package.json');
            if (contents) {
                const json = JSON.parse(contents.toString());
                version = json?.version ?? 'unknown version';
            }
        }
        catch (err) {
            if (err instanceof Error) {
                version = err.message;
            }
            else {
                version = 'error in aboutAPI';
            }
        }
        const site = req.headers.host === 'intranet.chums.com' ? '/api/b2b' : '/api';
        res.json({ site, version });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("aboutAPI()", err.message);
            return Promise.reject(err);
        }
        debug("aboutAPI()", err);
        return Promise.reject(new Error('Error in aboutAPI()'));
    }
};
