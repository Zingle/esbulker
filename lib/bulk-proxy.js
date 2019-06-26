const {EventEmitter} = require("events");
const requestHandler = require("./request-handler");
const {BulkProxyEndpoint} = require("./bulk-proxy-endpoint");

/**
 * Bulk proxy application.
 */
class BulkProxy extends EventEmitter {
    /**
     * @param {string} url
     */
    constructor(url) {
        super();

        const endpoints = new Map();
        const paused = false;

        this[$private] = {url, endpoints, paused};
    }

    /**
     * Maximum number of documents in queue before proxy is paused.
     * @type {number}
     */
    get breakerDocuments() {
        return this[$private].breakerDocuments || Infinity;
    }

    /**
     * Maximum size of queue before proxy is paused.
     * @type {number}
     */
    get breakerSize() {
        return this[$private].breakerSize || Infinity;
    }

    /**
     * Maximum number of documents to load per bulk insert.
     * @type {number}
     */
    get flushDocuments() {
        return this[$private].flushDocuments || Infinity;
    }

    /**
     * Maximum size of data to load per bulk insert.
     * @type {number}
     */
    get flushSize() {
        return this[$private].flushSize || Infinity;
    }

    /**
     * True if proxy is paused.
     * @type {boolean}
     */
    get paused() {
        return this[$private].paused;
    }

    /**
     * Number of times failed insert will be retried.
     * @type {number}
     */
    get retries() {
        return this[$private].retries || 0;
    }

    /**
     * Number of seconds before insert is considered slow.
     * @type {number}
     */
    get slowThreshold() {
        return this[$private].slowThreshold || Infinity;
    }

    /**
     * Elasticsearch server URL.
     * @type {string}
     */
    get url() {
        return this[$private].url;
    }

    /**
     * Change maximum number of documents in queue before proxy is paused.
     * @param {number} breakerDocuments
     */
    changeBreakerDocuments(breakerDocuments) {
        if (typeof breakerDocuments === "number" && breakerDocuments > 0) {
            this[$private].breakerDocuments = breakerDocuments;
        }
    }

    /**
     * Change maximum size of queue before proxy is paused.
     * @param {number} breakerSize
     */
    changeBreakerSize(breakerSize) {
        if (typeof breakerSize === "number" && breakerSize > 0) {
            this[$private].breakerSize = breakerSize;
        }
    }

    /**
     * Change maximum number of documents to load per bulk insert.
     * @param {number} flushDocuments
     */
    changeFlushDocuments(flushDocuments) {
        if (typeof flushDocuments === "number" && flushDocuments > 0) {
            this[$private].flushDocuments = flushDocuments;
        }
    }

    /**
     * Change maxmimum size of data to load per bulk insert.
     * @param {number} flushSize
     */
    changeFlushSize(flushSize) {
        if (typeof flushSize === "number" && flushSize > 0) {
            this[$private].flushSize = flushSize;
        }
    }

    /**
     * Change the number of times an insert will be retried before failing.
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
     * Return appropriate endpoint for an Elasticsearch index and document type.
     * @param {string} index
     * @param {string} doctype
     * @returns {BulkProxyEndpoint}
     */
    endpoint(index, doctype) {
        const {endpoints} = this[$private];
        const uri = `${index}/${doctype}/_bulk`;

        if (!endpoints.has(uri)) {
            const endpoint = new BulkProxyEndpoint(this, uri);

            pass(endpoint, "paused", this);
            pass(endpoint, "resumed", this);
            pass(endpoint, "inserted", this);
            pass(endpoint, "failed", this);
            pass(endpoint, "backoff", this);
            pass(endpoint, "error", this);

            endpoints.set(uri, endpoint);
        }

        return endpoints.get(uri);

        function pass(endpoint, event, proxy) {
            endpoint.on(event, (...args) => proxy.emit(event, ...args, endpoint));
        }
    }

    /**
     * Iterate over known endpoints.
     * @yields {BulkProxyEndpoint}
     */
    *endpoints() {
        yield* this[$private].endpoints.values();
    }

    /**
     * Create HTTP request handler to proxy requests.
     * @returns {function}
     */
    handler() {
        return requestHandler(this);
    }

    /**
     * Pause proxy.  Requests will start being rejected.
     */
    pause() {
        if (!this[$private].paused) {
            this[$private].paused = true;
            this.emit("paused");
        }
    }

    /**
     * Queue a document for loading.
     * @param {string} index
     * @param {string} doctype
     * @param {string} id
     * @param {object} doc
     * @param {string} [parent]
     */
    put(index, doctype, id, doc, parent) {
        const endpoint = this.endpoint(index, doctype);

        endpoint.put(id, doc, parent);

        if (endpoint.pending > this.breakerDocuments
            || endpoint.size > this.breakerSize) {

            // hit breaker limit; pause proxy
            this.pause();
        }
    }

    /**
     * Resume proxy after pausing.  Proxy will begin to accept requests again.
     */
    resume() {
        if (this[$private].paused) {
            this[$private].paused = false;
            this.emit("resumed");
        }
    }
}

/**
 * Accessor for BulkProxy private data.
 */
const $private = Symbol();

module.exports = {BulkProxy, $private};
