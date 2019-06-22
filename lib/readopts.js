const iteropt = require("iteropt");
const bytesized = require("bytesized");
const {CLIError} = iteropt;

/**
 * Read CLI arguments and return options object.
 * @param {string[]} argv
 * @returns {object}
 */
function readopts(argv) {
    const args = argv.slice();
    const options = defaults();

    options.node = args.shift();
    options.script = args.shift();

    for (const [opt, optval] of iteropt(args)) switch (opt) {
        case "--help":
            options.help = true;
            return options;
        case "--flush-docs":
            options.flushDocuments = positive(optval());
            if (!options.flushDocuments) {
                throw new CLIError(`option ${opt} expects positive integer`);
            }
            break;
        case "--flush-size":
            try { options.flushSize = size(optval()); } catch (err) {
                throw new CLIError(`option ${opt} expects number of bytes`);
            }

            if (!options.flushSize || options.flushSize < 0) {
                throw new CLIError(`option ${opt} expects number of bytes`);
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

module.exports = readopts;

/**
 * Create default options.
 * @returns {object}
 */
function defaults() {
    return {
        help: false,                // do not show help
        flushDocuments: Infinity,   // unlimited documents per load
        flushSize: Infinity,        // unlimited request size per load
    };
}

/**
 * Parse positive integer or infinity.
 * @param {string} value
 * @returns {number}
 */
function positive(value) {
    if (/^[1-9][0-9]*$/.test(value)) {
        return Number(value);
    } else if (value === "") {
        return Infinity;
    } else {
        return undefined;
    }
}

/**
 * Parse data size value into an integer.
 * @param {string} value
 * @returns {number}
 */
function size(value) {
    if (value === "") return Infinity;
    return bytesized(value);
}
