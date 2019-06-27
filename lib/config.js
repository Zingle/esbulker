const iteropt = require("iteropt");
const bytesized = require("bytesized");
const {entries} = Object;
const {CLIError} = iteropt;

/**
 * Return proxy default configuration.
 * @returns {object}
 */
function defaults() {
    return {
        address: undefined,         // listen on any IP address
        breakerDocuments: Infinity, // unlimited queued documents without break
        breakerSize: Infinity,      // unlimited queue size without break
        flushDocuments: Infinity,   // unlimited documents per load
        flushSize: Infinity,        // unlimited request size per load
        httpLog: false,             // do not log HTTP errors
        port: 1374,                 // listen for requests on port 1374
        retries: 0,                 // do not retry on problems connecting to ES
        slow: Infinity              // unlimited time to insert
    };
}

/**
 * Read CLI arguments and return configuration.
 * @param {string[]} argv
 * @returns {object}
 */
function readargs(argv) {
    const args = argv.slice();
    const options = {};

    options.node = args.shift();
    options.script = args.shift();

    for (const [opt, optval] of iteropt(args)) switch (opt) {
        case "--help":
            showhelp();
            process.exit(0);
            return options;
        case "--version":
            showver();
            process.exit(0);
            return options;
        case "--break-docs":
            if (isNaN(options.breakerDocuments = positiveInt(optval()))) {
                throw new CLIError(`option ${opt} expects positive integer`);
            }
            break;
        case "--break-size":
            if (isNaN(options.breakerSize = size(optval()))) {
                throw new CLIError(`option ${opt} expects bytes`);
            }
            break;
        case "--flush-docs":
            if (isNaN(options.flushDocuments = positiveInt(optval()))) {
                throw new CLIError(`option ${opt} expects positive integer`);
            }
            break;
        case "--flush-size":
            if (isNaN(options.flushSize = size(optval()))) {
                throw new CLIError(`option ${opt} expects bytes`);
            }
            break;
        case "--http-log":
            options.httpLog = optval();
            break;
        case "--ip":
            options.address = optval();
            break;
        case "--port":
            if (isNaN(options.port = positiveInt(optval()))) {
                throw new CLIError(`option ${opt} expects positive integer`);
            }
            break;
        case "--retry":
            if (isNaN(options.retries = unnegativeInt(optval()))) {
                throw new CLIError(`option ${opt} expects positive integer or zero`);
            }
            break;
        case "--slow":
            if (isNaN(options.slow = positiveInt(optval()))) {
                throw new CLIError(`option ${opt} expects positive integer`);
            }
            break;
        default:
            throw new CLIError(`option ${opt} is not recognized`);
    }

    switch (args.length) {
        case 0: throw new CLIError(`missing required endpoint`);
        case 1: options.url = args.shift(); break;
        default: throw new CLIError(`unexpected argument`);
    }

    return options;
}

/**
 * Read environment variables and return configuration.
 * @param {object} env
 * @returns {object}
 */
function readenv(env) {
    const options = {};

    if (env.BREAK_DOCS)     options.breakerDocuments = positiveInt(env.BREAK_DOCS);
    if (env.BREAK_SIZE)     options.breakerSize = size(env.BREAK_SIZE);
    if (env.FLUSH_DOCS)     options.flushDocuments = positiveInt(env.FLUSH_DOCS);
    if (env.FLUSH_SIZE)     options.flushSize = size(env.FLUSH_SIZE);
    if (env.HTTP_LOG)       options.httpLog = env.HTTP_LOG;
    if (env.LISTEN_ADDR)    options.address = env.LISTEN_ADDR;
    if (env.LISTEN_PORT)    options.port = positiveInt(env.LISTEN_PORT);
    if (env.REQ_RETRIES)    options.retries = unnegativeInt(env.REQ_RETRIES);
    if (env.SLOW_INSERT)    options.slow = positiveInt(env.SLOW_INSERT);

    // remove invalid values
    for (const [key, value] of entries(options)) {
        if (typeof value === "number" && isNaN(value)) delete options[key];
    }

    return options;
}

module.exports = {defaults, readargs, readenv};

/**
 * Parse positive integer or infinity.
 * @param {string} value
 * @returns {number}
 */
function positiveInt(value) {
    if (value === "") {
        return Infinity;
    } else if (isNaN(value = parseInt(value))) {
        return value;
    } else if (value <= 0) {
        return NaN;
    } else {
        return value;
    }
}

/**
 * Parse zero or positive integer.
 * @param {string} value
 * @returns {number}
 */
function unnegativeInt(value) {
    if (value === "") {
        return 0;
    } else if (isNaN(value = parseInt(value))) {
        return value;
    } else if (value < 0) {
        return NaN;
    } else {
        return value;
    }
}

/**
 * Parse data size.  Return Infinity on empty value.
 * @param {string} value
 * @returns {number}
 */
function size(value) {
    if (value === "") {
        return Infinity;
    } else if (isNaN(value = bytesized(value))) {
        return value;
    } else if (value < 0) {
        return NaN;
    } else {
        return value;
    }
}

/**
 * Display help.
 */
function showhelp() {
    console.log(
`Usage:
  esbulker [<OPTIONS>] <endpoint>
  esbulker --help

Start elasticsearch bulk load proxy.

ARGUMENTS

  endpoint                  URL of Elasticsearch server.

OPTIONS

  --help                    Show this help.
  --ip=<addr>               IP address proxy listens on.
  --flush-documents=<num>   Max documents loaded per request.
  --flush-size=<num>        Max size of data per request. (e.g. 256kib, 2mb)
  --port=<num>              Port proxy listens on.
  --slow=<num>              Slow insert threshold in seconds.
  --version                 Display version information.`
    );
}

/**
 * Display version information.
 */
function showver() {
    const {version} = require("../package");
    console.log(`esbulker v${version}`);
}
