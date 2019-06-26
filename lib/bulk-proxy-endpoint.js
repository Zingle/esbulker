const {EventEmitter} = require("events");
const {post} = require("./http");
const fib = require("./fib");
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
        const failed = undefined;
        const loading = false;
        const paused = false;
        const size = 0;

        this[$private] = {
            chunks, failed, loading, paused, proxy, size, uri,
            flushDocuments: undefined,
            flushSize: undefined,
            retries: undefined,
            slowThreshold: undefined
        };
    }

    /**
     * True if the last bulk insert failed.
     * @type {boolean}
     */
    get failed() {
        return Boolean(this[$private].failed);
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
     * True if bulk endpoint is loading documents.
     * @type {boolean}
     */
    get loading() {
        return this[$private].loading;
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
     * Size of document queue.
     * @type {number}
     */
    get size() {
        return this[$private].size;
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
     * Number of seconds before insert is considered slow.
     * @type {number}
     */
    get slowThreshold() {
        return this[$private].slowThreshold || this.proxy.slowThreshold;
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
     * Change number of seconds before insert is considered slow.
     * @param {number} slowThreshold
     */
    changeSlowThreshold(slowThreshold) {
        if (typeof slowThreshold === "number" && slowThreshold > 0) {
            this[$private].slowThreshold = slowThreshold;
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
     * @param {string} [parent]
     */
    put(id, doc, parent) {
        id = String(id);

        const {chunks} = this[$private];
        const action = {index: {_id: String(id)}};

        if (parent) action.index._parent = String(parent);

        // build chunk string with insert action and document
        const chunk = stringify(action) + "\n" + stringify(doc) + "\n";

        if (chunks.has(id)) {
            // id is getting replaced, so subtract chunk size from total size
            this[$private].size -= chunks.get(id).length;
        }

        // add chunk and add chunk size to total size
        chunks.set(id, chunk);
        this[$private].size += chunk.length;

        // ensure loading is started up
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
     * Reset number of seconds before insert is considered slow.
     */
    resetSlowThreshold() {
        this[$private].slowThreshold = undefined;
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
        const failed = endpoint.failed;
        const chunks = failed ? endpoint[$private].failed : [];
        const backoff = fib(500, 1500);
        const maxDelay = 15000;

        let length = 0;
        let retried = 0;
        let result, timer;

        if (!failed) for (const [id, chunk] of endpoint[$private].chunks) {
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
                await new Promise(ok => setTimeout(ok, min(maxDelay, backoff)));
            }

            try {
                timer = Date.now();
                result = await post(endpoint.url, chunks);
                endpoint[$private].size -= length;
                endpoint[$private].failed = undefined;
                endpoint.emit("inserted", chunks);
                endpoint.emit("insert", undefined, chunks);
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
            const elapsed = (Date.now() - timer) / 1000;
            const slow = elapsed > endpoint.slowThreshold;

            // pause on slow insert to avoid saturating ES
            if (slow) endpoint.pause();

            // loop if data is pending and endpoint isn't paused
            if (endpoint.pending && !endpoint.paused) setTimeout(load);

            // if not looping, unset loading flag
            else endpoint[$private].loading = false;
        }

        // handle empty load
        else if (!chunks.length) {
            // if paused, load may have been test; emit empty result
            if (endpoint.paused) endpoint.emit("insert", undefined, chunks);

            // unset the loading flag now that chunks are exhausted
            endpoint[$private].loading = false;
        }

        // pause the endpoint on failure
        else {
            endpoint[$private].failed = chunks;
            endpoint[$private].size -= length;
            endpoint.emit("failed", chunks);
            endpoint.emit("insert", new Error("bulk insert failed"), chunks);
            endpoint.pause();
            endpoint[$private].loading = false;
        }
    }
}
