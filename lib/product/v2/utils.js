import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
import { Decimal } from "decimal.js";
const debug = Debug('chums:lib:product:v2:utils');
export const SELL_AS_SELF = 1;
export const SELL_AS_VARIANTS = 0;
export const SELL_AS_MIX = 3;
export const SELL_AS_COLORS = 4;
export const checkExistingKeyword = async ({ id = 0, keyword, pagetype }) => {
    try {
        const query = `SELECT pagetype, keyword, id
                       FROM b2b_oscommerce.keywords
                       WHERE keyword = :keyword
                         AND NOT (pagetype = :pagetype AND id = :id)`;
        const data = { id: Number(id), keyword, pagetype };
        const [[row]] = await mysql2Pool.query(query, data);
        if (!!row && row.id !== id) {
            return Promise.reject(new Error(`Keyword ${keyword} already belongs to ${row.pagetype} ${row.id}`));
        }
    }
    catch (err) {
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
export function checkSellAs(val, test) {
    return test === (val & test);
}
export function parseImageFilename(productImage, colorCode) {
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
export const isCartItem = (item) => {
    if (!item) {
        return false;
    }
    return item.itemCode !== undefined;
};
export const isCartProduct = (item) => {
    if (!item) {
        return false;
    }
    return isCartItem(item) && item.productId !== undefined;
};
export const isProduct = (product) => {
    if (!product) {
        return false;
    }
    return product.id !== undefined;
};
export function isCategoryChildSection(child) {
    return child.itemType === 'section';
}
export function isCategoryChildCategory(child) {
    return child.itemType === 'category';
}
export function isCategoryChildProduct(child) {
    return child.itemType === 'product';
}
export function isCategoryChildLink(child) {
    return child.itemType === 'link';
}
export function isSellAsSelf(product) {
    return !!product && product.sellAs === SELL_AS_SELF;
}
export function isSellAsVariants(product) {
    return !!product && product.sellAs === SELL_AS_VARIANTS;
}
export function isSellAsMix(product) {
    return !!product && product.sellAs === SELL_AS_MIX;
}
export function isSellAsColors(product) {
    return !!product && product.sellAs === SELL_AS_COLORS;
}
export const hasVariants = (product) => {
    if (isSellAsVariants(product)) {
        const variants = product.variants ?? [];
        return variants
            .filter(v => v.status)
            .length > 0;
    }
    return false;
};
export const defaultVariant = (product, sku) => {
    const variants = product.variants ?? [];
    const activeVariants = variants.filter(v => v.status);
    if (sku) {
        let variant = variants.find(v => v.product?.itemCode === sku);
        if (variant) {
            return variant;
        }
        [variant] = variants.filter(v => {
            if (!isSellAsColors(v.product)) {
                return false;
            }
            const items = v.product.items;
            return items.filter(item => item.itemCode === sku).length > 0;
        });
        if (variant) {
            return variant;
        }
    }
    const [variant] = activeVariants.filter(v => v.isDefaultVariant);
    return variant ?? activeVariants[0] ?? null;
};
export const getPrice = (product) => {
    if (isSellAsColors(product)) {
        const items = product.items;
        const prices = [];
        items
            .filter(item => !(!item.status || item.inactiveItem || item.productType === 'D'))
            .filter(item => !!item.msrp)
            .forEach(item => {
            const price = new Decimal(item.msrp).toFixed(2);
            if (!prices.includes(price)) {
                prices.push(price);
            }
        });
        if (prices.length === 0) {
            return [new Decimal(product.msrp ?? 0).toFixed(2)];
        }
        if (prices.length === 1) {
            return prices;
        }
        const sortedPrices = prices.sort((a, b) => new Decimal(a).gt(b) ? 1 : -1);
        return [sortedPrices[0], sortedPrices[sortedPrices.length - 1]];
    }
    if (isSellAsSelf(product)) {
        return [new Decimal(product.msrp ?? 0).toFixed(2)];
    }
    if (isSellAsMix(product)) {
        return [new Decimal(product.msrp ?? 0).toFixed(2)];
    }
    return [];
};
export const getSalesUM = (product) => {
    if (!product) {
        return '';
    }
    if (isSellAsColors(product)) {
        const um = [];
        const items = product.items ?? [];
        items
            .filter(item => !(!item.status || item.inactiveItem || item.productType === 'D' || !item.salesUM))
            .forEach(item => {
            if (!!item.salesUM && !um.includes(item.salesUM)) {
                um.push(item.salesUM);
            }
        });
        return um.join(',');
    }
    return product.salesUM ?? '';
};
export const defaultCartItem = (product, option) => {
    if (isSellAsColors(product)) {
        const productItems = product.items;
        const items = productItems.filter(item => item.status);
        let cartItem;
        [cartItem] = items.filter(item => item.itemCode === option?.itemCode);
        if (!cartItem) {
            [cartItem] = items.filter(item => item.colorCode === option?.colorCode || item.color.code === option?.colorCode);
        }
        if (!cartItem) {
            [cartItem] = items.filter(item => item.colorCode === product.defaultColor);
        }
        if (!cartItem && items.length) {
            cartItem = items[0];
        }
        if (!cartItem) {
            return null;
        }
        return colorCartItem(cartItem, product);
    }
    if (isSellAsMix(product)) {
        const items = product.mix.items ?? [];
        let [color] = items.filter(item => item.color?.code === (option?.colorCode ?? product.defaultColor))
            .map(item => item.color);
        if (!color) {
            [color] = items.filter(item => item.color?.code === product.defaultColor)
                .map(item => item.color);
        }
        const [image_filename] = items
            .filter(item => item.color?.code === color?.code)
            .map(item => {
            if (item.additionalData && item.additionalData.image_filename) {
                return item.additionalData.image_filename;
            }
            return null;
        });
        return {
            itemCode: product.itemCode,
            quantity: 1,
            productId: product.id,
            name: product.name,
            colorCode: color?.code,
            colorName: color?.name,
            image: image_filename ?? parseImageFilename2({ image: product.image, colorCode: color?.code }),
            msrp: product.msrp,
            stdPrice: product.stdPrice,
            priceCode: product.priceCode,
            salesUM: product.salesUM,
            stdUM: product.stdUM,
            salesUMFactor: product.salesUMFactor,
            seasonCode: product.season_code,
            seasonAvailable: product.additionalData?.seasonAvailable || product.season_available,
            quantityAvailable: product.QuantityAvailable,
            season: product.season ?? null,
        };
    }
    if (!product) {
        return null;
    }
    return {
        image: product.image,
        name: product.name,
        productId: product.id,
        itemCode: product.itemCode,
        stdPrice: product.stdPrice,
        salesUM: product.salesUM,
        salesUMFactor: product.salesUMFactor,
        quantityAvailable: product.QuantityAvailable,
        msrp: product.msrp,
        quantity: 1,
        seasonCode: product.season_code,
        seasonAvailable: product.season_available
    };
};
export const parseImageFilename2 = ({ image, colorCode }) => parseColor(image, colorCode ?? '');
export const parseColor = (str, colorCode = '') => {
    if (!str) {
        return '';
    }
    colorCode = String(colorCode);
    str = str.replace(/\?/, colorCode);
    colorCode.split('').map(code => {
        str = str.replace(/\*/, code);
    });
    return str.replace(/\*/g, '');
};
export const colorCartItem = (item, product) => {
    return {
        quantityAvailable: item.QuantityAvailable,
        msrp: item.msrp,
        colorCode: item.color.code ?? item.colorCode,
        itemCode: item.itemCode,
        stdPrice: item.stdPrice,
        salesUM: item.salesUM,
        salesUMFactor: item.salesUMFactor,
        colorName: item.color.name ?? item.colorName,
        priceCode: item.priceCode,
        price: item.msrp?.toString(),
        productId: item.productId,
        stdUM: item.stdUM,
        image: (item.additionalData?.image_filename ?? '') || parseImageFilename2({
            image: product?.image ?? '',
            colorCode: item.color.code ?? item.colorCode ?? ''
        }),
        name: product?.name ?? item.colorName,
        quantity: 1,
        season: item.additionalData?.season ?? product?.season ?? null,
        seasonCode: item.additionalData?.season?.code,
        seasonAvailable: !isPreSeason(item, product),
        seasonDescription: item.additionalData?.season?.description,
        seasonTeaser: item.additionalData?.season?.product_teaser,
        preSeasonMessage: (item.additionalData?.season?.product_available || item.additionalData?.seasonAvailable)
            ? null
            : (item.additionalData?.season?.preSeasonMessage ?? product?.preSeasonMessage ?? product?.dateAvailable),
        message: item.additionalData?.message,
    };
};
const isPreSeason = (item, product) => {
    if (item.additionalData?.season && item.additionalData.season.active) {
        return !(item.additionalData.seasonAvailable || item.additionalData.season.product_available);
    }
    if (product?.season && product.season.active) {
        return !product.season.product_available;
    }
    return false;
};
export function parsePossiblyMissingFilename(productImage, colorCode) {
    if (!productImage) {
        return null;
    }
    return parseImageFilename3(productImage, colorCode);
}
export function parseImageFilename3(productImage, colorCode) {
    if (!productImage.trim()) {
        return 'missing-placeholder2.jpg';
    }
    let image = productImage.replace(/\?/, colorCode ?? '');
    if (colorCode) {
        colorCode.split('').map(code => {
            image = image.replace(/\*/, code);
        });
    }
    return image.replace(/\*/g, '').replace(/\s/g, '%20');
}
export function getImageItemCode(product, colorCode) {
    if (!product) {
        return null;
    }
    if (isSellAsSelf(product)) {
        return product.itemCode ?? null;
    }
    if (isSellAsMix(product)) {
        const items = product.mix.items ?? [];
        const item = items.find(item => item.color?.code === colorCode);
        return item?.itemCode ?? null;
    }
    return null;
}
