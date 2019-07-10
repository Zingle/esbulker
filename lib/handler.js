const http = require("http");
const stringWriter = require("@zingle/string-writer");
const {parse: urlparse} = require("url");
const {parse: qsparse} = require("querystring");

const bulk = require("./bulk")

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
                    const body = await readBody(req, res);

                    if (["", "true", "wait_for"].includes(header.refresh)) {
                        await bulk(esurl, header, body);
                        sendStatusText(res);
                    } else {
                        bulk(esurl, header, body);
                        res.statusCode = 202;
                        sendStatusText(res);
                    }

                    break;
                case "status":
                    const {queue, cutoff} = header;

                    if (!queue || !cutoff) {
                        res.statusCode = 404;
                        sendStatusText(res);
                    } else if (cutoff < queue.oldest) {
                        sendText(res, "inserted");
                    } else {
                        sendText(res, "queued");
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
 * Read request header.  Update response status and headers on error.
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @returns {Header}
 */
function readHeader(req, res) {
    return /^\/_queue\/.+/.test(req.url)
        ? readStatusHeader(req, res)
        : readInsertHeader(req, res);
}

/**
 * Read status request header.  Update response status and headers on error.
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @returns {StatusHeader}
 */
function readStatusHeader(req, res) {
    const {method, url} = req;
    const {pathname: path} = urlparse(url);
    const [$, $$, offset, extra] = path.split("/");
    const action = "status";

    // only GET is allowed
    if (method !== "GET") {
        res.setHeader("Allow", "GET");
        res.statusCode = 405;
        throw new Error("invalid method in header");
    }

    // only full queue offset URL is recognized
    if (offset === undefined || extra !== undefined) {
        res.statusCode = 404;
        throw new Error("invalid URL in header");
    }

    const decoded = new Buffer(offset, "hex").toString("ascii");
    const [queue, when] = decoded.split("|");

    return {action, queue, when: Number(when)};
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
 * @property {string} queue
 * @property {number} cutoff
 */
