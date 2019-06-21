const http = require("http");
const https = require("https");
const {parse} = require("url");
const {assign} = Object;

/**
 * Create function which posts chunked data to an HTTP endpoint.
 * @param {string} url
 * @returns {Endpoint}
 */
function endpoint(url) {
    const web = parse(url).protocol === "https:" ? https : http;

    return post;

    async function post(chunks) {
        const length = chunks.reduce((a,b) => a+b.length, 0);
        const headers = {"content-length": length};
        const req = web.request(assign(parse(url), {method: "POST", headers}));

        return new Promise((resolve, reject) => {
            req.on("error", reject);

            req.on("response", res => {
                const {statusCode} = res;

                if (statusCode >= 200 && statusCode < 300) {
                    resolve(statusCode);
                } else {
                    reject(new Error(`unexpected ${statusCode} response`));
                }
            });

            chunks.forEach(chunk => req.write(chunk));
            req.end();
        });
    }
}

module.exports = endpoint;

/**
 * Post data to HTTP endpoint.
 * @name Endpoint
 * @function
 * @param {string[]} chunks
 * @returns {number}
 * @async
 */
