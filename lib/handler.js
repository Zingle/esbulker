const http = require("http");
const {parse: urlparse} = require("url");
const {parse: qsparse} = require("querystring");
const bytesized = require("bytesized");
const stringWriter = require("@zingle/string-writer");
const bulk = require("./bulk")
const {all: queues} = require("./queue");

const MAX_QUEUE_SIZE = bytesized("250MiB");

module.exports = handler;

/**
 * Create HTTP request handler to bulk Elasticsearch requests and proxy them to
 * an Elasticsearch server.
 * @param {string} esurl
 * @returns {function}
 */
function handler(esurl) {
    return handle;

    async function handle(req, res) {
        try {
            const header = readHeader(req, res);

            switch (header.action) {
                case "insert":
                    if (calculateQueueSize() > MAX_QUEUE_SIZE) {
                        res.statusCode = 503;
                        sendStatusText(res);
                    } else if (["", "true", "wait_for"].includes(header.refresh)) {
                        const body = await readBody(req, res);
                        await bulk(esurl, header, body);
                        sendData(res, makeResponse(header));
                    } else {
                        const body = await readBody(req, res);
                        bulk(esurl, header, body);
                        res.statusCode = 202;
                        sendData(res, makeResponse(header));
                    }

                    break;
                default:
                    res.statusCode = 500;
                    console.error("unexpected action");
                    sendStatusText(res);
            }
        } catch (err) {
            if (err instanceof SyntaxError) {
                res.statusCode = 400;
            }

            if (res.statusCode >= 200 && res.statusCode < 300) {
                res.statusCode = 500;
            }

            console.error(err.stack);
            sendStatusText(res);
        }
    }
}

/**
 * Calculate the total queue size.
 */
function calculateQueueSize() {
    return Array.from(queues()).reduce((a,b) => a+b.size, 0);
}

/**
 * Create response body for successful PUT.
 * @param {Header} header
 * @returns {object}
 */
function makeResponse(header) {
    return {
        _index: header.index,
        _type: header.type,
        _id: header.id,
        _version: -1,
        created: true
    };
}

/**
 * Read request header.  Update response status and headers on error.
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @returns {Header}
 */
function readHeader(req, res) {
    // TODO: support status URLs such as GET /_queue/f43b72c1
    return readInsertHeader(req, res);
}

/**
 * Read insert request header.  Update response status and headers on error.
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @returns {StatusHeader}
 */
function readInsertHeader(req, res) {
    const {method, url} = req;
    const {pathname: path, query} = urlparse(url);
    const {parent, refresh} = qsparse(query);
    const [_, index, doctype, id, extra] = path.split("/");
    const action = "insert";

    // only PUT is allowed
    if (method !== "PUT") {
        res.setHeader("Allow", "PUT");
        res.statusCode = 405;
        throw new Error("invalid method in header");
    }

    // only full document URL with id is recognized
    if (id === undefined || extra !== undefined) {
        res.statusCode = 404;
        throw new Error("invalid URL in header");
    }

    return {action, index, doctype, id, parent, refresh};
}

/**
 * Read request body.
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @returns {object}
 */
async function readBody(req, res) {
    return new Promise((resolve, reject) => {
        const body = stringWriter();

        req.pipe(body).on("error", reject);

        body.on("finish", () => {
            try {
                resolve(JSON.parse(String(body)));
            } catch (err) {
                reject(err);
            }
        });
    });
}

/**
 * Send text response.  Sets content-type header and ensures response ends in
 * newline.
 * @param {ServerResponse} res
 * @param {string} text
 */
function sendText(res, text) {
    if (text.slice(-1) !== "\n") text += "\n";
    res.setHeader("Content-Type", "text/plain; charset=us-ascii");
    res.write(text);
    res.end();
}

/**
 * Send text response based on the response status code.
 * @param {ServerResponse} res
 */
function sendStatusText(res) {
    const {statusCode} = res;
    if (statusCode === 204) res.end();
    else sendText(res, `${statusCode} ${http.STATUS_CODES[statusCode]}`);
}

/**
 * Send response data.
 * @param {ServerResponse} res
 * @param {object} data
 */
function sendData(res, data) {
    res.setHeader("Content-Type", "application/json");
    res.write(JSON.stringify(data) + "\n");
    res.end();
}

/**
 * @typedef {(InsertHeader|StatusHeader)} Header
 * @property {string} action
 */

/**
 * @typedef {object} InsertHeader
 * @property {string} index
 * @property {string} doctype
 * @property {string} id
 * @property {string|undefined} parent
 * @property {string|undefined} refresh
 */

/**
 * @typedef {object} StatusHeader
 * @property {string} endpoint
 * @property {number} cutoff
 */
