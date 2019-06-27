const http = require("http");
const https = require("https");
const tlsopt = require("tlsopt");
const {CLIError} = require("iteropt");
const stringWriter = require("@zingle/string-writer");
const readopts = require("./lib/readopts");
const {BulkProxy} = require("./lib/bulk-proxy");
const recover = require("./lib/recover");
const {file: logfile, none: nolog} = require("./lib/console");
const {HTTPUnhandledStatusError} = require("./lib/http");

const {entries} = Object;

try {
    const port = process.env.LISTEN_PORT || 1374;
    const address = process.env.LISTEN_ADDR || undefined;
    const options = readopts(process.argv);

    if (options.help) {
        help();
        process.exit(0);
    } else if (options.version) {
        const package = require("./package");
        console.log(`esbulk v${package.version}`);
        process.exit(0);
    }

    const httpConsole = options.httpLog ? logfile(options.httpLog) : nolog();
    const proxy = new BulkProxy(options.url);
    const tls = tlsopt.readSync();
    const secure = Boolean(tls.pfx || tls.cert);
    const server = secure
        ? https.createServer(tls, proxy.handler())
        : http.createServer(proxy.handler())

    if (options.breakerDocuments) {
        proxy.changeBreakerDocuments(options.breakerDocuments);
    }

    if (options.breakerSize) {
        proxy.changeBreakerSize(options.breakerSize);
    }

    if (options.flushDocuments) {
        proxy.changeFlushDocuments(options.flushDocuments);
    }

    if (options.flushSize) {
        proxy.changeFlushSize(options.flushSize);
    }

    if (options.retries) {
        proxy.changeRetries(Number(options.retries));
    }

    if (options.slow) {
        proxy.changeSlowThreshold(options.slow);
    }

    proxy.on("paused", endpoint => {
        if (endpoint) {
            console.info(`writing to ${endpoint.url} has been paused`);
        } else {
            console.warn(`proxy has gone down`);
        }

        recover(endpoint || proxy);
    });

    proxy.on("resumed", endpoint => {
        if (endpoint) {
            console.info(`writing to ${endpoint.url} has been resumed`);
        } else {
            console.info(`proxy has come back up`);
        }
    });

    proxy.on("backoff", (ms, inserts, endpoint) => {
        const loading = inserts.length;
        const total = loading + endpoint.pending;
        console.info(`backoff ${ms/1000}s ${loading}/${total} document(s) [${endpoint.url}]`);
    });

    proxy.on("inserted", (inserts, endpoint) => {
        console.info(`inserted ${inserts.length} document(s) [${endpoint.url}]`);
    });

    proxy.on("failed", (inserts, endpoint) => {
        console.error(`failed to insert ${inserts.length} document(s) [${endpoint.url}]`);

        if (process.env.DUMP_LOST) {
            console.error(inserts.join("").trim());
        }
    });

    proxy.on("error", (err, endpoint) => {
        if (endpoint) console.error(`${err.message} [${endpoint.url}]`);
        else console.error(`${err.message}`);

        if (process.env.DEBUG) console.error(err.stack);

        if (err instanceof HTTPUnhandledStatusError) {
            const resbody = stringWriter("utf8");
            const {req, res} = err;

            res.pipe(resbody).on("error", console.error).on("finish", () => {
                const protocol = req.connection.encrypted ? "https" : "http";
                const {host} = req.getHeaders();
                const header = `** UNEXPECTED HTTP STATUS **`;

                httpConsole.error(Array(header.length).fill("*").join(""));
                httpConsole.error(header);
                httpConsole.error(Array(header.length).fill("*").join(""));

                httpConsole.error(`${req.method} ${req.path} HTTP/1.1`);
                httpConsole.error(`Host: ${host}`);
                httpConsole.error(`Date: ${new Date()}`);
                httpConsole.error(`X-Forwarded-Proto: ${protocol}`);
                httpConsole.error();
                httpConsole.error(req.body.trimRight());
                httpConsole.error(Array(header.length).fill("-").join(""));
                httpConsole.error(`${res.statusCode} ${res.statusMessage}`);
                httpConsole.error();
                httpConsole.error(String(resbody).trimRight());

                httpConsole.error(Array(header.length).fill("*").join(""));
            });
        }
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
  --flush-size=<num>        Max size of data per request. (e.g. 256kib, 2mb)
  --slow=<num>              Slow insert threshold in seconds.`
    );

    process.exit(0);
}
