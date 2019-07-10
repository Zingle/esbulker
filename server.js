const http = require("http");
const https = require("https");
const tlsopt = require("tlsopt");
const {CLIError} = require("iteropt");
const handler = require("./lib/handler");
const {defaults, readenv, readargs} = require("./lib/config");

try {
    const {assign} = Object;
    const {env, argv} = process;
    const options = assign(defaults(), readenv(env), readargs(argv));
    const web = options.secure ? https : http;
    const serverOpts = options.secure ? [options.tls] : [];
    const server = web.createServer(...serverOpts, handler(options.url));

    if (options.verbosity < 2) console.debug = () => {};
    if (options.verbosity < 1) console.info = () => {};
    if (options.verbosity < 0) console.warn = () => {};
    if (options.verbosity < -1) console.error = () => {};

    server.listen(...[options.port, options.address].filter(a => a), () => {
        const {address, port} = server.address();
        console.debug(`listening on ${address}:${port}`);
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
