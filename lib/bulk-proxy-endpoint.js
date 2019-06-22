const {EventEmitter} = require("events");
const Endpoint = require("./endpoint");
const fib = require("./fib");
const sleep = require("./sleep");
const {assign, freeze} = Object;
const {round, min} = Math;
const {isInteger} = Number;
const {stringify} = JSON;

/**
 * Bulk proxy endpoint for document aggregation and loading.
 */
class BulkProxyEndpoint extends EventEmitter {
    /**
     * Configure the endpoint proxy endpoint URL.
     * @param {BulkProxy} proxy
     * @param {string} uri
     */
    constructor(proxy, uri) {
        super();

        const chunks = new Map();
        const loading = false;
        const paused = false;

        this[$private] = {
            chunks, loading, paused, proxy, uri,
            flushDocuments: undefined,
            flushSize: undefined,
            retries: undefined
        };

        this[$private].endpoint = Endpoint(this.url);
    }

    /**
     * True if bulk endpoint is loading documents.
     * @type {boolean}
     */
    get loading() {
        return this[$private].loading;
    }

    /**
     * Number of documents to queue before flushing.
     * @type {number}
     */
    get flushDocuments() {
        return this[$private].flushDocuments || this.proxy.flushDocuments;
    }

    /**
     * Size of data to queue before flushing.
     * @type {number}
     */
    get flushSize() {
        return this[$private].flushSize || this.proxy.flushSize;
    }

    /**
     * True if loading is paused.
     * @type {boolean}
     */
    get paused() {
        return this[$private].paused;
    }

    /**
     * Number of pending documents to be loaded.
     * @type {number}
     */
    get pending() {
        return this[$private].chunks.size;
    }

    /**
     * Proxy application to which this endpoint belongs.
     * @type {BulkProxy}
     */
    get proxy() {
        return this[$private].proxy;
    }

    /**
     * Number of times request will be retried.
     * @type {number}
     */
    get retries() {
        return this[$private].retries || this.proxy.retries;
    }

    /**
     * Bulk target URI.
     * @type {string}
     */
    get uri() {
        return this[$private].uri;
    }

    /**
     * Bulk target URL.
     * @type {string}
     */
    get url() {
        return `${this.proxy.url}/${this.uri}`;
    }

    /**
     * Change the number of documents to queue before flushing.
     * @param {number} flushDocuments
     */
    changeFlushDocuments(flushDocuments) {
        if (typeof flushDocuments === "number" && flushDocuments > 0) {
            this[$private].flushDocuments = flushDocuments;
        }
    }

    /**
     * Change size of document data to queue before flushing.
     * @param {number} flushSize
     */
    changeFlushSize(flushSize) {
        if (typeof flushSize === "number" && flushSize > 0) {
            this[$private].flushSize = flushSize;
        }
    }

    /**
     * Change number of times failed insert will be retried.
     * @param {number} retries
     */
    changeRetries(retries) {
        if (typeof retries === "number" && retries >= 0) {
            this[$private].retries = retries;
        }
    }

    /**
     * Execute the next bulk insert.
     */
    next() {
        // if an insert is active, no need to do anything
        if (this.loading) return;

        // if unpaused, no need to do anything
        if (!this.paused) return;

        start(this);
    }

    /**
     * Pause loading.
     */
    pause() {
        if (!this[$private].paused) {
            this[$private].paused = true;
            this.emit("paused");
        }
    }

    /**
     * Queue a document to for bulk loading.
     * @param {string} id
     * @param {object} doc
     */
    put(id, doc) {
        const action = {index: {_id: id}};
        const chunk = stringify(action) + "\n" + stringify(doc) + "\n";

        this[$private].chunks.set(id, chunk);
        if (!this.loading && !this.paused) start(this);
    }

    /**
     * Reset maximum number of documents to queue before flushing.
     */
    resetFlushDocuments() {
        this[$private].flushDocuments = undefined;
    }

    /**
     * Reset maximum size of data to queue before flushing.
     */
    resetFlushSize() {
        this[$private].flushSize = undefined;
    }

    /**
     * Reset number of times failed insert will be retried.
     */
    resetRetries() {
        this[$private].retries = undefined;
    }

    /**
     * Resume loading after pausing or failure.
     */
    resume() {
        if (this[$private].paused) {
            this[$private].paused = false;
            this.emit("resumed");
        }

        if (!this.loading) {
            start(this);
        }
    }
}

/**
 * Accessor for BulkProxyEndpoint private data.
 */
const $private = Symbol();

module.exports = {BulkProxyEndpoint, $private};

/**
 * Start loading documents into endpoint.
 * @param {BulkProxyEndpoint} endpoint
 */
function start(endpoint) {
    if (endpoint[$private].loading) {
        throw new Error("already started");
    }

    endpoint[$private].loading = true;
    setTimeout(load);

    async function load() {
        const chunks = [];
        const backoff = fib(500, 1500);
        const maxDelay = 15000;

        let length = 0;
        let retried = 0;
        let result;

        for (const [id, chunk] of endpoint[$private].chunks) {
            chunks.push(chunk);
            length += chunk.length;
            endpoint[$private].chunks.delete(id);

            if (chunks.length > endpoint.flushDocuments) {
                break;
            }

            if (length > endpoint.flushSize) {
                break;
            }
        }

        // attempt to load data in a loop until retries are exhausted
        while (chunks.length && retried <= endpoint.retries) {
            if (retried) {
                endpoint.emit("backoff", Number(backoff.next()), chunks);
                await sleep(min(maxDelay, backoff));
            }

            try {
                result = await endpoint[$private].endpoint(chunks);
                endpoint.emit("result", true, chunks);
                break;  // break out of loop on success
            } catch (err) {
                // HACK: emitting in reaction to Promise rejection causes
                // "UnhandledPromiseRejectionWarning" instead of more relevant
                // "Unhandled 'error' event"; emit on future tick so errors
                // are relevant
                setTimeout(() => endpoint.emit("error", err));
                retried++;
            }
        }

        // handle successful result
        if (result) {
            // loop if data is pending and endpoint isn't paused
            if (endpoint.pending && !endpoint.paused) setTimeout(load);

            // if not looping, unset loading flag
            else endpoint[$private].loading = false;
        }

        // handle empty load
        else if (!chunks.length) {
            // if paused, load may have been test; emit empty result
            if (endpoint.paused) endpoint.emit("result", true, chunks);

            // unset the loading flag now that chunks are exhausted
            endpoint[$private].loading = false;
        }

        // pause the endpoint on failure
        else {
            endpoint.emit("result", false, chunks);
            endpoint.pause();
            endpoint[$private].loading = false;
        }
    }
}
