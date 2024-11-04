const assert = require('assert');
const {fetchResults} = require("./fetchResults");

describe('ProductList', function () {
    let live, dev;
    before(async function () {
        const results = await fetchResults('products/list/12');
        live = results.live;
        dev = results.dev;
    });
    it ('should match result from existing API', async function () {
        assert.deepEqual(live, dev)
    })
})
