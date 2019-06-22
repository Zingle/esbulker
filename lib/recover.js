const PROXY_RECOVER_WAIT = 30 * 1000;

/**
 * Attempt to recover proxy.
 * @param {BulkProxy} proxy
 * @returns {BulkProxy}
 */
async function recover(proxy) {
    // flag set when proxy has recovered
    let recovered;

    while (!recovered && proxy.paused) {
        // assume recovered initially
        recovered = true;

        // proxy settings to compare with endpoints
        const {breakerDocuments, breakerSize} = proxy;

        // sleep for a bit before checking for recovery
        await new Promise(resolve => setTimeout(resolve, PROXY_RECOVER_WAIT));

        // check each endpoint for recovery
        for (const endpoint of proxy.endpoints()) {
            if (endpoint.pending > breakerDocuments
                || endpoint.size > breakerSize) {

                // endpoint has not yet recovered
                recovered = false;
                break;
            }
        }
    }

    proxy.resume();
    return proxy;
}

module.exports = recover;
