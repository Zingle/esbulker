const {createWriteStream} = require("fs");
const {Console} = require("console");
const files = new Map();

/**
 * Create console which writes to file.  File is reopened on HUP signal.
 * @param {string} path
 * @returns {Console}
 */
function file(path) {
    let output, file;

    if (!files.has(path)) {
        files.set(path, {
            log(...args)    {file && file.log(...args);},
            debug(...args)  {file && file.debug(...args);},
            info(...args)   {file && file.info(...args);},
            warn(...args)   {file && file.warn(...args);},
            error(...args)  {file && file.error(...args);}
        });

        open();
        process.on("SIGHUP", open);
    }

    return files.get(path);

    function open() {
        if (output) output.end();
        output = createWriteStream(path, {flags: "a"});
        file = new Console(output);
    }
}

/**
 * Create degenerate console that does nothing.
 * @returns {Console}
 */
function none() {
    return {log() {}, debug() {}, info() {}, warn() {}, error() {}};
}

module.exports = {file, none};
