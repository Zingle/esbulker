const {EventEmitter} = require("events");
const Endpoint = require("./endpoint");
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
        const retries = 0;
        const loading = false;
        const paused = false;

        this[$private] = {
            chunks, retries, loading, paused, proxy, uri,
            flushDocuments: undefined,
            flushSize: undefined
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
        return this[$private].retries;
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
    changeFlushDocuents(flushDocuments) {
        if (typeof flushDocuments === "number" && flushDocuments > 0) {
            this[$private].flushDocuments = flushDocuments;
        }
    }

    /**
     * Change size of document data to queue before flushing.
     * @param {number} flushSize
     */
    changeFlushSize(size) {
        if (typeof flushSize === "number" && flushSize > 0) {
            this[$private].flushSize = flushSize;
        }
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
            try {
                result = await endpoint[$private].endpoint(chunks);
                endpoint.emit("inserted", chunks);
                break;  // break out of loop on success
            } catch (err) {
                // HACK: emitting in reaction to Promise rejection causes
                // "UnhandledPromiseRejectionWarning" instead of more relevant
                // "Unhandled 'error' event"; emit on future tick so errors
                // are relevant
                setTimeout(() => endpoint.emit("error", err));
                endpoint.emit("lost", chunks);
                console.error(`lost ${chunks.length} document(s) [${endpoint.url}]`);
                console.error(`-----`);
                console.error(chunks.join("").trim());
                console.error(`=====`)
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

        // pause the endpoint on failure
        else {
            endpoint.pause();
            endpoint[$private].loading = false;
        }
    }
}
