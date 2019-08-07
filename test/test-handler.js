const http = require("http");
const {Readable} = require("stream");
const expect = require("expect.js");
const stringWriter = require("@zingle/string-writer");
const handler = require("../lib/handler");

require("./lib/polyfill");

const {assign} = Object;

describe("handler(string)", () => {
    let handle, requestHandler, server, esurl;
    let req, reqbody;
    let res, resbody;

    beforeEach(done => {
        req = assign(Readable.from("{}"), {method: "PUT", url: "/foo/bar/buzz"});
        res = assign(stringWriter(), {statusCode: 200, foo: "foo"});

        res.setHeader = () => {};

        server = http.createServer((req, res) => {
            requestHandler(req, res);
        });

        server.listen(() => {
            esurl = `http://localhost:${server.address().port}`;
            handle = handler(esurl);
            done();
        });

        console.debug = () => {};
        console.info = () => {};
        console.error = () => {};
    });

    afterEach(() => {
        delete console.debug;
        delete console.info;
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
        expect(res.foo).to.be("foo");
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
