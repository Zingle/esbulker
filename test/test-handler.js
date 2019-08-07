const {Readable} = require("stream");
const expect = require("expect.js");
const nock = require("nock");
const stringWriter = require("@zingle/string-writer");
const handler = require("../lib/handler");

require("./lib/polyfill");

const {assign} = Object;

describe("handler(string)", () => {
    const esurl = "http://es.example.com:9200";
    const handle = handler(esurl);
    let req, res;

    beforeEach(() => {
        console.debug = () => {};
        console.info = () => {};
        console.warn = () => {};
        console.error = () => {};

        req = assign(Readable.from("{}"), {method: "PUT", url: "/foo/bar/buzz"});
        res = assign(stringWriter(), {setHeader() {}, statusCode: 200});
    });

    afterEach(() => {
        delete console.debug;
        delete console.info;
        delete console.warn;
        delete console.error;
    });

    it("should return async HTTP request handler", () => {
        requestHandler = (req, res) => {};

        expect(handle).to.be.a("function");
        expect(handle.length).to.be(2);
        expect(handle(req, res)).to.be.a(Promise);
    });

    it("should accept PUT requests", async () => {
        await handle(req, res);
        expect(res.statusCode).to.be(202);
    });

    it("should only accept PUT requests", async () => {
        req.method = "GET";
        await handle(req, res).catch(() => {});
        expect(res.statusCode).to.be(405);
    });

    it("should not find short URLs", async () => {
        req.url = "/foo/bar";
        await handle(req, res).catch(() => {});
        expect(res.statusCode).to.be(404);
    });

    it("should not find long URLs", async () => {
        req.url = "/foo/bar/baz/bang";
        await handle(req, res).catch(() => {});
        expect(res.statusCode).to.be(404);
    });

    it("should stop serving once queue is full", async () => {

    });
});
