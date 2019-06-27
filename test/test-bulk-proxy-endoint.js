const expect = require("expect.js");
const {EventEmitter} = require("events");
const {BulkProxyEndpoint} = require("..");

// TODO: test insert by throwing up HTTP server

describe("BulkProxyEndpoint(BulkProxy, string)", () => {
    const flushDocuments = 13;
    const flushSize = 23;
    const retries = 3;
    const slowThreshold = 200;
    const url = "http://localhost:9200";
    const proxy = {flushDocuments, flushSize, retries, slowThreshold, url};
    const uri = "foodex/bardoc/_bulk";
    let endpoint, lasterr;

    beforeEach(() => {
        endpoint = new BulkProxyEndpoint(proxy, uri);
        endpoint.on("error", err => lasterr = err);
    });

    it("should construct object inheriting EventEmitter", () => {
        expect(endpoint).to.be.a(BulkProxyEndpoint);
        expect(endpoint).to.be.an(EventEmitter);
    });

    it("should initialize properties", () => {
        expect(endpoint.proxy).to.be(proxy);
        expect(endpoint.uri).to.be(uri);
        expect(endpoint.loading).to.be(false);
        expect(endpoint.paused).to.be(false);
        expect(endpoint.pending).to.be(0);
        expect(endpoint.size).to.be(0);
    })

    it("should be configurable, inheriting from BulkProxy", () => {
        expect(endpoint.flushDocuments).to.be(proxy.flushDocuments);
        expect(endpoint.flushSize).to.be(proxy.flushSize);
        expect(endpoint.retries).to.be(proxy.retries);
        expect(endpoint.slowThreshold).to.be(proxy.slowThreshold);

        endpoint.changeFlushDocuments(proxy.flushDocuments+1);
        endpoint.changeFlushSize(proxy.flushSize+1);
        endpoint.changeRetries(proxy.retries+1);
        endpoint.changeSlowThreshold(proxy.slowThreshold+1);

        expect(endpoint.flushDocuments).to.be(proxy.flushDocuments+1);
        expect(endpoint.flushSize).to.be(proxy.flushSize+1);
        expect(endpoint.retries).to.be(proxy.retries+1);
        expect(endpoint.slowThreshold).to.be(proxy.slowThreshold+1);

        endpoint.resetFlushDocuments();
        endpoint.resetFlushSize();
        endpoint.resetRetries();
        endpoint.resetSlowThreshold();

        expect(endpoint.flushDocuments).to.be(proxy.flushDocuments);
        expect(endpoint.flushSize).to.be(proxy.flushSize);
        expect(endpoint.retries).to.be(proxy.retries);
        expect(endpoint.slowThreshold).to.be(proxy.slowThreshold);
    });

    it("should construct url from proxy url and endpoint uri", () => {
        expect(endpoint.url).to.be(`${proxy.url}/${uri}`);
    });

    it("should emit paused/resumed events when changing state", () => {
        let paused = 0;
        let resumed = 0;

        endpoint.on("paused", () => paused++);
        endpoint.on("resumed", () => resumed++);

        endpoint.pause();   expect(paused).to.be(1);
        endpoint.pause();   expect(paused).to.be(1);
        endpoint.resume();  expect(resumed).to.be(1);
        endpoint.resume();  expect(resumed).to.be(1);
        endpoint.pause();   expect(paused).to.be(2);
        endpoint.resume();  expect(resumed).to.be(2);
    });

    it("should be able to bypass pause for single load", () => {
        endpoint.pause();

        expect(endpoint.paused).to.be(true);
        expect(endpoint.loading).to.be(false);

        endpoint.next();

        expect(endpoint.paused).to.be(true);
        expect(endpoint.loading).to.be(true);
    });

    it("should update pending and size when document is queued", () => {
        expect(endpoint.pending).to.be(0);
        expect(endpoint.size).to.be(0);
        endpoint.put("foo", {id: "foo"});
        expect(endpoint.pending).to.be(1);
        expect(endpoint.size).to.be.greaterThan(0);
    });

    it("should indicate if document was created or overwritten", () => {
        expect(endpoint.put("foo", {})).to.be(true);
        expect(endpoint.put("foo", {})).to.be(false);
    });
});
