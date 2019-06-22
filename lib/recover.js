const sleep = require("./sleep");
const {max} = Math;

const PROXY_DOWNTIME = 30 * 1000;   // time proxy goes down on problem
const RECOVER_WAIT = 1000;          // wait at which endpoint recovers
const BASE_WAIT = 30 * 1000;        // initial wait after failure
const MAX_WAIT = 15 * 60 * 1000;    // maximum wait after subsequent failures
const GOLDEN_RATIO = 1.61803398875; // wait growth rate

/**
 * Attempt to recover a proxy or endpoint.
 * @param {BulkProxy|BulkProxyEndpoint} paused
 * @returns {BulkProxy|BulkProxyEndpoint}
 */
async function recover(paused) {
    // use heuristic for typing to avoid circular dependency
    return paused.endpoint ? recoverProxy(paused) : recoverEndpoint(paused);
}

/**
 * Attempt to recover proxy.
 * @param {BulkProxy} proxy
 * @returns {BulkProxy}
 */
async function recoverProxy(proxy) {
    // flag set when proxy has recovered
    let recovered;

    // time to go down while proxy is recovering
    let downtime = proxy.downtime || PROXY_DOWNTIME;

    while (!recovered && proxy.paused) {
        // assume recovered initially
        recovered = true;

        // proxy settings to compare with endpoints
        const {breakerDocuments, breakerSize} = proxy;

        // sleep for a bit before checking for recovery
        await new Promise(resolve => setTimeout(resolve, downtime));

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

/**
 * Attempt to recover an endpoint.
 * @param {BulkProxyEndpoint} endpoint
 * @returns {BulkProxyEndpoint}
 */
async function recoverEndpoint(endpoint) {
    let wait = endpoint.wait || BASE_WAIT;

    while (endpoint.paused && wait > RECOVER_WAIT) {
        await sleep(wait);

        try {
            await attempt();
            wait /= 2;
        } catch (err) {
            wait = max(wait*GOLDEN_RATIO, BASE_WAIT);
        }
    }

    endpoint.resume();

    return endpoint;

    async function attempt() {
        return new Promise((resolve, reject) => {
            const attempted = Date.now();

            endpoint.once("result", success => {
                const elapsed = (Date.now() - attempted) / 1000;
                const slow = elapsed > endpoint.slowThreshold;

                if (success && !slow) resolve();
                else reject();
            });

            endpoint.next();
        });
    }
}

module.exports = recover;
