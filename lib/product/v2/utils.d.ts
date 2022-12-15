interface CheckExistingKeywordProps {
    id?: number | string;
    keyword: string;
    pagetype: string;
}
export declare const checkExistingKeyword: ({ id, keyword, pagetype }: CheckExistingKeywordProps) => Promise<void>;
export declare const SELL_AS: {
    SELF: number;
    MIX: number;
    COLOR: number;
};
export declare function checkSellAs(val: number, test: number): boolean;
export declare function parseImageFilename(productImage: string, colorCode: string | number): string;
export {};
/**
 *
 * @param {Object} fields - {paramField: 'mysqlField', ...}
 * @param {Object} params - {param: value, ...}
 * @return {{update: string, data: {id: *}}}
 */
