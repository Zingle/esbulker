const sleep = require("./sleep");
const {max} = Math;

const RECOVER_WAIT = 1000;          // wait at which endpoint recovers
const BASE_WAIT = 30 * 1000;        // initial wait after failure
const MAX_WAIT = 15 * 60 * 1000;    // maximum wait after subsequent failures
const GOLDEN_RATIO = 1.61803398875; // wait growth rate

/**
 * Attempt to recover an endpoint.
 * TODO: better pass-through of wait option
 * @param {BulkProxyEndpoint} endpoint
 * @param {number} [wait]
 * @returns {BulkProxyEndpoint}
 */
async function recover(endpoint, wait=BASE_WAIT) {
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
