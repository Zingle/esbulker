const {URL} = require("url");
const {STATUS_CODES} = require("http");
const stringWriter = require("./string-writer");
const {assign} = Object;

/**
 * Create request handler to send PUTs to a bulk proxy.
 * @param {BulkProxy} proxy
 * @returns {function}
 */
function requestHandler(proxy) {
    /**
     * @param {IncomingMessage} req
     * @param {ServerResponse} res
     */
    return (req, res) => {
        const {method, url: path} = req;
        const [_, index, type, id] = path.split("/");
        const body = stringWriter();

        // reject anything but PUT; bulk proxy only handles PUTs
        if (method !== "PUT") {
            res.setHeader("Allow", "PUT");
            return sendStatus(405);
        }

        // reject URLs that don't have a document id
        if (id === undefined) {
            return sendStatus(404);
        }

        // read in request body
        req.pipe(body).on("error", err => {
            // log error details
            console.error(process.env.DEBUG ? err.stack : err.message);

            // send user generic error
            sendStatus(500);
        });

        // once entire body has been received, add doc to queue
        body.on("finish", () => {
            const url = new URL(path, proxy.url);
            const reqopts = assign({}, url, {method});

            try {
                proxy.put(index, type, id, JSON.parse(String(body)));
                sendStatus(202);
            } catch (err) {
                if (err instanceof SyntaxError) {
                    sendStatus(400);
                } else {
                    console.error(process.env.DEBUG ? err.stack : err.message);
                    sendStatus(500);
                }
            }
        });

        function sendStatus(status) {
            res.statusCode = status;
            res.write(`${status} ${STATUS_CODES[status]}\n`);
            res.end();
        }
    };
}

module.exports = requestHandler;
