import {mysql2Pool} from "chums-local-modules";
import Debug from "debug";

const debug = Debug('chums:lib:search:item-search');

export async function loadSearch(search){
    try {
        const smartSearch = /[\\^$*%_]/g.test(search)
            ? search.replace('*', '[\\w]*')
                .replace('%', '[.]*')
                .replace('_', '[\\w]{1}')
            : `\\b${search}`;
        const sql = `SELECT DISTINCT i.company,
                                   i.ItemCode,
                                   i.ItemCodeDesc,
                                   i.StandardUnitPrice,
                                   i.SuggestedRetailPrice,
                                   i.SalesUnitOfMeasure,
                                   i.SalesUMConvFctr,
                                   img.filename
                   FROM c2.ci_item i
                        INNER JOIN c2.im_itemwarehouse iw
                                  ON iw.Company = i.Company AND iw.ItemCode = i.ItemCode # and iw.WarehouseCode = i.DefaultWarehouseCode
                        LEFT JOIN (
                       SELECT i.Company, i.ItemCode, MIN(filename) AS filename
                       FROM c2.ci_item i
                            INNER JOIN c2.PM_Images img
                                       ON img.item_code = i.ItemCode
                       WHERE i.company = 'chums'
                         AND item_code = i.ItemCode
                       GROUP BY i.Company, i.ItemCode
                       ) img
                                  ON img.Company = i.Company AND img.ItemCode = i.ItemCode
                        LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                  ON ia.company = i.company AND ia.ItemCode = i.ItemCode AND
                                     ia.WarehouseCode = i.DefaultWarehouseCode
                   WHERE i.Company = 'chums'
                     AND i.ItemType = '1'
                     AND i.InactiveItem <> 'Y'
                     AND i.ProductType in ('F', 'K')
                     AND (
                               i.ItemCode RLIKE :search
                           OR i.ItemCodeDesc RLIKE :search
                           OR i.UDF_UPC RLIKE :search
                           OR i.UDF_UPC_BY_COLOR RLIKE :search
                       )
                     AND iw.WarehouseCode = '000'
                   AND i.StandardUnitPrice <> 0
                   AND iw.QuantityOnHand > 0
                   AND i.ItemCode not like '%EC'
                   AND i.ItemCode not like '%FBA'
                   ORDER BY i.ItemCode
                   LIMIT 50`;
        const [rows] = await mysql2Pool.query(sql, {search: smartSearch});
        return rows;
    } catch(err) {
        if (err instanceof Error) {
            console.debug("loadSearch()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadSearch()", err);
        return Promise.reject(new Error('Error in loadSearch()'));
    }
}

export const getItemSearch = async (req, res) => {
    try {
        const items = await loadSearch(req.params.term);
        res.json({items});
    } catch(err) {
        if (err instanceof Error) {
            debug("getItemSearch()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getItemSearch'});
    }
}
