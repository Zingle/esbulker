const {EventEmitter} = require("events");
const expect = require("expect.js");
const {BulkProxyEndpoint} = require("..");

// TODO: test insert by throwing up HTTP server

describe("BulkProxyEndpoint(BulkProxy, string)", () => {
    const proxy = {flushDocuments: 13, flushSize: 23, url: "http://localhost:9200"};
    const uri = "foodex/bardoc/_bulk";
    let endpoint, lasterr;

    beforeEach(() => {
        endpoint = new BulkProxyEndpoint(proxy, uri);
        endpoint.on("error", err => lasterr = err);
    })

    it("should create endpoint inheriting EventEmitter", () => {
        expect(endpoint).to.be.a(BulkProxyEndpoint);
        expect(endpoint).to.be.an(EventEmitter);
    });

    it("should initialize properties", () => {
        expect(endpoint.proxy).to.be(proxy);
        expect(endpoint.uri).to.be(uri);
        expect(endpoint.loading).to.be(false);
        expect(endpoint.paused).to.be(false);
        expect(endpoint.pending).to.be(0);
    })

    it("should inherit config from BulkProxy", () => {
        expect(endpoint.flushDocuments).to.be(proxy.flushDocuments);
        expect(endpoint.flushSize).to.be(proxy.flushSize);

        endpoint.changeFlushDocuments(proxy.flushDocuments+1);
        endpoint.changeFlushSize(proxy.flushSize+1);

        expect(endpoint.flushDocuments).to.be(proxy.flushDocuments+1);
        expect(endpoint.flushSize).to.be(proxy.flushSize+1);

        endpoint.resetFlushDocuments();
        endpoint.resetFlushSize();

        expect(endpoint.flushDocuments).to.be(proxy.flushDocuments);
        expect(endpoint.flushSize).to.be(proxy.flushSize);
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

    it("queue document should increment pending", () => {
        expect(endpoint.pending).to.be(0);
        endpoint.put("foo", {id: "foo"});
        expect(endpoint.pending).to.be(1);
    });
});
