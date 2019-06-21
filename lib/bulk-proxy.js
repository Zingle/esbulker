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
        this[$private] = {url, endpoints: new Map()};
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
     * Elasticsearch server URL.
     * @type {string}
     */
    get url() {
        return this[$private].url;
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
            pass(endpoint, "result", this);
            pass(endpoint, "error", this);

            endpoints.set(uri, endpoint);
        }

        return endpoints.get(uri);

        function pass(endpoint, event, proxy) {
            endpoint.on(event, (...args) => proxy.emit(event, ...args, endpoint));
        }
    }

    /**
     * Create HTTP request handler to proxy requests.
     * @returns {function}
     */
    handler() {
        return requestHandler(this);
    }

    /**
     * Queue a document for loading.
     * @param {string} index
     * @param {string} doctype
     * @param {string} id
     * @param {object} data
     */
    put(index, doctype, id, doc) {
        this.endpoint(index, doctype).put(id, doc);
    }
}

/**
 * Accessor for BulkProxy private data.
 */
const $private = Symbol();

module.exports = {BulkProxy, $private};
