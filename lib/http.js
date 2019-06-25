const http = require("http");
const https = require("https");
const {parse} = require("url");
const {assign} = Object;

/**
 * Make HTTP POST request against a URL.
 * @param {object} [headers]
 * @param {string} url
 * @param {string[]} chunks
 * @returns {IncomingMessage}
 */
async function post(headers, url, chunks) {
    if (arguments.length < 3) [headers, url, chunks] = [{}, headers, url];

    const web = parse(url).protocol === "https:" ? https : http;
    const length = chunks.reduce((a,b) => a+b.length, 0);
    const req = web.request(assign(parse(url), {method: "POST", headers}));

    assign(headers, {"content-length": length});

    return new Promise((resolve, reject) => {
        req.on("error", reject);

        req.on("response", res => {
            const {statusCode} = res;

            if (statusCode >= 200 && statusCode < 300) {
                resolve(res);
            } else {
                assign(req, {body: chunks.join("")});
                reject(new HTTPUnhandledStatusError(req, res));
            }
        });

        chunks.forEach(chunk => req.write(chunk));

        req.end();
    });
}

/**
 * Throw when an HTTP response has a status code which cannot be handled.
 */
class HTTPUnhandledStatusError extends Error {
    /**
     * @param {ClientRequest} req
     * @param {IncomingMessage} res
     */
    constructor(req, res) {
        const {method, path} = req;
        const {statusCode, statusMessage} = res;
        const status = `${statusCode} ${statusMessage}`;

        super(`unexpected ${status} response trying to ${method} ${path}`);

        assign(this, req, res);
        freeze(this);
    }

    get status() {
        return this.res.statusCode;
    }
}

module.exports = {post, HTTPUnhandledStatusError};
