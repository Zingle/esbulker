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
        address: undefined,             // listen on any IP address
        port: 1374,                     // listen for requests on port 1374
        secure: false,                  // do not use TLS
        tls: null,                      // TLS options if secure is true
        url: "http://localhost:9200",   // default ES server
        verbosity: 0                    // default log level
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
        case "--es":
            options.url = optval();
            break;
        case "--ip":
            options.address = optval();
            break;
        case "--port":
            if (isNaN(options.port = positiveInt(optval()))) {
                throw new CLIError(`option ${opt} expects positive integer`);
            }
            break;
        case "-q":
        case "--quiet":
            options.verbosity = (options.verbosity || 0) - 1;
            break;
        case "-v":
        case "--verbose":
            options.verbosity = (options.verbosity || 0) + 1;
            break;
        case "--tls-cert":
        case "--tls-key":
        case "--tls-ca":
            // these are handled by tlsopt module; simply read value to ensure
            // options are parsed without error
            optval();
            break;
        default:
            throw new CLIError(`option ${opt} is not recognized`);
    }

    if (args.length) {
        throw new CLIError(`unexpected argument`);
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

    if (env.ES_URL)         options.url = env.ES_URL;
    if (env.LISTEN_ADDR)    options.address = env.LISTEN_ADDR;
    if (env.LISTEN_PORT)    options.port = positiveInt(env.LISTEN_PORT);

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
 * Display help.
 */
function showhelp() {
    console.log(
`Usage:
  esbulker [-v|-q] [--es=<url>] [--ip=<addr>] [--port=<num>]
  esbulker --help
  esbulker --version

Start elasticsearch bulk load proxy.

OPTIONS

  --help                    Show this help.
  --es=<url>                Elasticsearch server URL.
  --ip=<addr>               IP address proxy listens on.
  --port=<num>              Port proxy listens on.
  -q|--quiet                Show less output.
  -v|--verbose              Show more output.
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
