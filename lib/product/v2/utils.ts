import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';
import {RowDataPacket} from "mysql2";
import {
    CartItem,
    CartProduct,
    CategoryChildCategory,
    CategoryChildLink,
    CategoryChildProduct,
    CategoryChildSection,
    CustomerPriceRecord,
    Product,
    ProductCategoryChild, ProductSellAsColors, ProductSellAsMix,
    ProductSellAsSelf, ProductSellAsVariants,
    SellAsColorsProduct,
    SellAsMixProduct,
    SellAsSelfProduct,
    SellAsVariantsProduct
} from "b2b-types";


const debug = Debug('chums:lib:product:v2:utils');


interface CheckExistingKeywordRow extends RowDataPacket {
    pagetype: string,
    keyword: string,
    id: number
}

interface CheckExistingKeywordProps {
    id?: number | string,
    keyword: string,
    pagetype: string,
}

export const SELL_AS_SELF:ProductSellAsSelf = 1;
export const SELL_AS_VARIANTS:ProductSellAsVariants = 0;
export const SELL_AS_MIX:ProductSellAsMix = 3;
export const SELL_AS_COLORS: ProductSellAsColors = 4;

export const checkExistingKeyword = async ({id = 0, keyword, pagetype}: CheckExistingKeywordProps): Promise<void> => {
    try {
        const query = `SELECT pagetype, keyword, id
                       FROM b2b_oscommerce.keywords
                       WHERE keyword = :keyword
                         AND NOT (pagetype = :pagetype AND id = :id)`;
        const data = {id: Number(id), keyword, pagetype};
        const [[row]] = await mysql2Pool.query<CheckExistingKeywordRow[]>(query, data);
        if (!!row && row.id !== id) {
            return Promise.reject(new Error(`Keyword ${keyword} already belongs to ${row.pagetype} ${row.id}`));
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("checkExistingKeyword()", err.message);
            return Promise.reject(err);
        }
        debug("checkExistingKeyword()", err);
        return Promise.reject(new Error('Error in checkExistingKeyword()'));
    }
};


export const SELL_AS = {
    SELF: 1,
    MIX: 3,
    COLOR: 4
};

export function checkSellAs(val: number, test: number) {
    return test === (val & test);
}


export function parseImageFilename(productImage: string, colorCode: string | number): string {
    if (productImage === null) {
        return '';
    }
    if (colorCode === null) {
        colorCode = '';
    }
    if (typeof colorCode === 'number') {
        colorCode = String(colorCode);
    }
    productImage = productImage.replace(/\?/, colorCode);
    colorCode.split('').map(code => {
        productImage = productImage.replace(/\*/, code);
    });
    productImage = productImage.replace(/\*/g, '');
    return productImage;
}

/**
 *
 * @param {Object} fields - {paramField: 'mysqlField', ...}
 * @param {Object} params - {param: value, ...}
 * @return {{update: string, data: {id: *}}}
 */
// export const updateQueryFields = (fields, params) => {
//     const updateFields = [];
//     const data = {id: params.id};
//     Object.keys(fields)
//         .map(f => {
//             if (params[f]) {
//                 updateFields.push(`${fields[f]} = :${f}`);
//                 data[f] = params[f];
//             }
//         });
//     const update = updateFields.join(', ');
//     return {update, data};
// };


export const isCartItem = (item:CartItem|null): item is CartItem => {
    if (!item) {
        return false;
    }
    return (item as CartItem).itemCode !== undefined;
}

export const isCartProduct = (item:CartProduct|CartItem|null): item is CartProduct => {
    if (!item) {
        return false;
    }
    return isCartItem(item) && (item as CartProduct).productId !== undefined;
}

export const isProduct = (product:Product|null): product is Product => {
    if (!product) {
        return false;
    }
    return (product as Product).id !== undefined;
}

export function isCategoryChildSection(child: ProductCategoryChild): child is CategoryChildSection {
    return (child as CategoryChildSection).itemType === 'section';
}

export function isCategoryChildCategory(child: ProductCategoryChild): child is CategoryChildCategory {
    return (child as CategoryChildCategory).itemType === 'category';
}

export function isCategoryChildProduct(child: ProductCategoryChild): child is CategoryChildProduct {
    return (child as CategoryChildProduct).itemType === 'product';
}

export function isCategoryChildLink(child: ProductCategoryChild): child is CategoryChildLink {
    return (child as CategoryChildLink).itemType === 'link';
}

export function isSellAsSelf(product: Product|null): product is SellAsSelfProduct {
    return !!product && (product as SellAsSelfProduct).sellAs === SELL_AS_SELF;
}

export function isSellAsVariants(product: Product|null): product is SellAsVariantsProduct {
    return !!product && (product as SellAsVariantsProduct).sellAs === SELL_AS_VARIANTS;
}

export function isSellAsMix(product: Product|null): product is SellAsMixProduct {
    return !!product && (product as SellAsMixProduct).sellAs === SELL_AS_MIX;
}

export function isSellAsColors(product: Product|null): product is SellAsColorsProduct {
    return !!product && (product as SellAsColorsProduct).sellAs === SELL_AS_COLORS;
}

