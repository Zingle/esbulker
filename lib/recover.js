const {max} = Math;

const RECOVER_WAIT = 1000;          // wait at which endpoint recovers
const BASE_WAIT = 30 * 1000;        // initial wait after failure
const MAX_WAIT = 15 * 60 * 1000;    // maximum wait after subsequent failures
const GOLDEN_RATIO = 1.61803398875; // wait growth rate

/**
 * Attempt to recover an endpoint.
 * @param {BulkProxyEndpoint} endpoint
 * @returns {BulkProxyEndpoint}
 */
async function recover(endpoint) {
    let wait = BASE_WAIT;

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
            endpoint.once("result", success => success ? resolve() : reject());
            endpoint.next();
        });
    }
}

module.exports = recover;

// TODO: remove this after sleep module gets merged

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
