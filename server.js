const http = require("http");
const https = require("https");
const tlsopt = require("tlsopt");
const {CLIError} = require("iteropt");
const readopts = require("./lib/readopts");
const {BulkProxy} = require("./lib/bulk-proxy");

try {
    const port = process.env.LISTEN_PORT || 1374;
    const address = process.env.LISTEN_ADDR || undefined;
    const options = readopts(process.argv);

    if (options.help) {
        help();
        process.exit(0);
    }

    const proxy = new BulkProxy(options.url);
    const tls = tlsopt.readSync();
    const secure = Boolean(tls.pfx || tls.cert);
    const server = secure
        ? https.createServer(tls, proxy.handler())
        : http.createServer(proxy.handler())

    if (options.flushDocuments) {
        proxy.changeFlushDocuments(Number(options.flushDocuments));
    }

    if (options.flushSize) {
        proxy.changeFlushSize(Number(options.flushSize));
    }

    if (options.retries) {
        proxy.changeRetries(options.retries);
    }

    proxy.on("paused", endpoint => {
        console.info(`writing to ${endpoint.url} has been paused`);
    });

    proxy.on("resumed", endpoint => {
        console.info(`writing to ${endpoint.url} has been resumed`);
    });

    proxy.on("inserted", (inserts, endpoint) => {
        console.info(`inserted ${inserts.length} document(s) [${endpoint.url}]`);
    });

    proxy.on("backoff", (ms, inserts, endpoint) => {
        const loading = inserts.length;
        const total = loading + endpoint.pending;
        console.info(`backoff ${ms/1000}s ${loading}/${total} document(s) [${endpoint.url}]`);
    });

    proxy.on("lost", (lost, endpoint) => {
        console.error(`lost ${lost.length} documents(s) [${endpoint.url}]`);
        if (process.env.DEBUG) console.error(lost.join(""));
    });

    proxy.on("error", (err, endpoint) => {
        console.error(`${err.message} [${endpoint.url}]`);
        if (process.env.DEBUG) console.error(err.stack);
    });

    if (!secure) {
        console.warn("transport security not enabled");
    }

    server.listen(...[port, address].filter(a => a), () => {
        const {address, port} = server.address();
        console.info(`listening on ${address}:${port}`);
    });
} catch (err) {
    if (err instanceof CLIError) {
        console.error(err.message);
        console.error(`try --help for more information`);
        process.exit(1);
    } else {
        console.error(process.env.DEBUG ? err.stack : err.message);
        process.exit(100);
    }
}

/**
 * Display help.
 */
function help() {
    console.log(
`Usage:
  esbulker [<OPTIONS>] <endpoint>
  esbulker --help

Start elasticsearch bulk load proxy.

ARGUMENTS

  endpoint                  URL of Elasticsearch server.

OPTIONS

  --help                    Show this help.
  --flush-documents=<num>   Max documents loaded per request.
  --flush-size=<num>        Max size of data per request.
`
    );

    process.exit(0);
}
