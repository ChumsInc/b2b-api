const {apiFetch} = require('chums-local-modules');


async function fetchResults(url) {
    const [liveResponse, devResponse] = await Promise.all([
        apiFetch(`https://intranet.chums.com/api/b2b/${url}`),
        apiFetch(`http://localhost:8001/${url}`)
    ]);
    const live = await liveResponse.json();
    const dev = await devResponse.json();
    return {live, dev}
}

exports.fetchResults = fetchResults;
