import 'dotenv/config.js'
import {mysql2Pool} from "chums-local-modules";
import equal from "fast-deep-equal";

// this script is to remove excessive history entries in the cart_detail table
// prior to 2/12/2026 history was added during cart sync even though the cart had not changed.

const sqlDetail = `SELECT h.id                         AS headerId,
                          h.salesOrderNo,
                          h.customerKey,
                          d.id                         AS detailId,
                          d.lineKey,
                          d.itemCode,
                          JSON_LENGTH(d.history, '$')  AS historyCount,
                          JSON_EXTRACT(d.history, '$') AS history
                   FROM b2b.cart_header h
                            INNER JOIN b2b.cart_detail d ON h.id = d.cartHeaderId
                   WHERE JSON_LENGTH(d.history) > 1                
`;

const sqlUpdate = `UPDATE b2b.cart_detail
                   SET history = :history
                   WHERE id = :detailId 
                     and cartHeaderId = :headerId`;

async function fixHistory() {
    try {
        const [rows] = await mysql2Pool.query(sqlDetail);
        for await (const row of rows) {
            const history = JSON.parse(row.history);
            const actions = history.filter(h => h.action !== 'syncFromC2(update)');
            const c2 = history.filter(h => h.action === 'syncFromC2(update)');
            if (c2.length <= 1) continue;
            if (c2.length > 1) {
                const validHistory = [c2[0]];
                for (let i = 1; i < c2.length; i++) {
                    if (!equal(c2[i].history, c2[i - 1].history)) {
                        validHistory.push(c2[i]);
                    }
                }
                const itemHistory = [...actions, ...validHistory].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
                if (itemHistory.length !== history.length) {
                    console.log(row.customerKey, row.headerId, row.detailId, c2.length, validHistory.length, itemHistory.length);
                    await mysql2Pool.query(sqlUpdate, {history: JSON.stringify(itemHistory), headerId: row.headerId, detailId: row.detailId});
                }
            }
        }
        console.log("Done");
        process.exit(0);
    } catch(err) {
        if (err instanceof Error) {
            console.debug("fixHistory()", err.message);
            return Promise.reject(err);
        }
        console.debug("fixHistory()", err);
        return Promise.reject(new Error('Error in fixHistory()'));
    }
}

await fixHistory().catch(err => console.error(err));
