const assert = require('assert');
const {fetchResults} = require("./fetchResults");

describe('Product', function() {
    describe('GET /products/v2/keywords/original-standard', function () {
        let liveProduct, devProduct;
        before(async function() {
            const {live, dev} = await fetchResults('products/v2/keyword/original-standard');
            liveProduct = live;
            devProduct = dev;
        })

        it ('should match result from existing API', async function () {
            assert.deepEqual(liveProduct, devProduct)
        })
    });
    describe('GET /products/v2/keyword/original-small-end', function () {
        let liveProduct, devProduct;
        before(async function() {
            const {live, dev} = await fetchResults('products/v2/keyword/original-small-end');
            liveProduct = live;
            devProduct = dev;
        })

        it ('should match result from existing API', async function () {
            assert.deepEqual(liveProduct, devProduct)
        })
    });
    describe('GET /products/v2/keyword/original-large-end', function () {
        let liveProduct, devProduct;
        before(async function() {
            const {live, dev} = await fetchResults('products/v2/keyword/original-large-end');
            liveProduct = live;
            devProduct = dev;
        })

        it ('should match result from existing API', async function () {
            assert.deepEqual(liveProduct, devProduct)
        })
    });
    describe('GET /products/v2/keyword/transporter-singles-2023', function () {
        let liveProduct, devProduct;
        before(async function() {
            const {live, dev} = await fetchResults('products/v2/keyword/transporter-singles-2023');
            liveProduct = live;
            devProduct = dev;
        })

        it ('should match result from existing API', async function () {
            assert.deepEqual(liveProduct, devProduct)
        })
    });
    describe('GET /products/v2/keyword/reversi-wallet-basic-mix', function () {
        let liveProduct, devProduct;
        before(async function() {
            const {live, dev} = await fetchResults('products/v2/keyword/reversi-wallet-basic-mix');
            liveProduct = live;
            devProduct = dev;
        })

        it ('should match result from existing API', async function () {
            assert.deepEqual(liveProduct, devProduct)
        })
    });
});
