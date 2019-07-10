const {parse} = require("url");
const http = require("http");
const https = require("https");
const bytesized = require("bytesized");
const Queue = require("./queue");

const MAX_INSERT_SIZE = bytesized("2MiB");
const SLOW_INSERT_TIME = 2000;
const BACKOFF_MIN = 500;
const BACKOFF_INCREASE = 1.61803398875;     // golden ratio
const BACKOFF_DECREASE = 0.5;
const BACKOFF_MAX = 60000;

const {assign} = Object;
const started = new Map();

module.exports = bulk;

/**
 * Bulk insert document into Elasticsearch.
 * @param {string} esurl
 * @param {Header} header
 * @param {object} body
 */
async function bulk(esurl, header, body) {
    const {index, doctype, id, refresh} = header;
    let uri = undefined;

    switch (header.refresh) {
        case "":
        case "true":
            uri = `${index}/_bulk?refresh=true`;
            break;
        case "wait_for":
            uri = `${index}/_bulk?refresh=wait_for`;
            break;
        default:
            uri = `${index}/${doctype}/_bulk`;
    }

    const queue = Queue(esurl, uri);

    queue(header, body);
    start(queue);
}

/**
 * Stop loading queue into Elasticsearch.
 * @param {Queue} queue
 */
function stop(queue) {
    if (started.has(queue)) {
        console.info(`stopping queue for ${queue.url}`);

        if (typeof started.get(queue) === "number") {
            clearTimeout(started.get(queue));
            started.delete(queue);
        } else {
            started.set(queue, false);
        }
    }
}

/**
 * Start loading queue into Elasticsearch if not already.
 * @param {Queue} queue
 */
function start(queue) {
    const chunks = [];
    const {url} = queue;

    let delay = 0;
    let size = 0;

    if (!started.has(queue) || started.get(queue) === false) {
        console.info(`starting queue for ${queue.url}`);
        started.set(queue, setTimeout(run));
    }

    async function run() {
        if (queue.length + chunks.length === 0) {
            return;
        }

        while (queue.length && size < MAX_INSERT_SIZE) {
            const {data} = queue.shift();
            chunks.push(data);
            size += data.length;
        }

        try {
            started.set(queue, true);

            const timer = Date.now();
            await post(url, chunks.join(""));
            const delta = Date.now() - timer;

            console.info(`loaded ${chunks.length} documents into ${queue.url}`);

            chunks.splice(0, chunks.length)
            size = 0;

            if (delta >= SLOW_INSERT_TIME) {
                console.info(`slow insert into ${queue.url}`);
                backoff();
            } else {
                rampup();
            }
        } catch (err) {
            console.error(process.env.DEBUG ? err.stack : err.message);
            console.warn(`insert failed for ${queue.url}`);
            backoff();
        }

        if (queue.length + chunks.length === 0) {
            console.info(`queue exhausted for ${queue.url}`);
            started.delete(queue);
        } else if (started.get(queue) === false) {
            started.delete(queue);
        } else {
            started.set(queue, setTimeout(run, delay));
        }
    }

    function backoff() {
        if (!delay) delay = BACKOFF_MIN;
        delay *= BACKOFF_INCREASE;
        if (delay > BACKOFF_MAX) delay = BACKOFF_MAX;
    }

    function rampup() {
        delay *= BACKOFF_DECREASE;
        if (delay < BACKOFF_MIN) delay = 0;
    }
}

/**
 * Make HTTP POST request.
 * @param {string} url
 * @param {string} body
 */
async function post(url, body) {
    const method = "POST";
    const web = parse(url).protocol === "https:" ? https : http;
    const req = web.request(assign(parse(url), {method}));

    return new Promise((resolve, reject) => {
        req.on("error", reject);

        req.on("response", res => {
            const {statusCode} = res;

            if (statusCode >= 200 && statusCode < 300) {
                resolve(res);
            } else {
                reject(new Error(`unhandled HTTP status ${statusCode}`));
            }
        });

        req.write(body);
        req.end();
    });
}
