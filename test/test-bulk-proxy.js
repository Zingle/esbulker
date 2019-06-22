const expect = require("expect.js");
const {EventEmitter} = require("events");
const {BulkProxy, BulkProxyEndpoint} = require("..");

describe("BulkProxy(string)", () => {
    const url = "http://localhost:9200";
    const index = "foodex";
    const doctype = "bardoc";
    let proxy, lasterr;

    beforeEach(() => {
        proxy = new BulkProxy(url);
        proxy.on("error", err => lasterr = err);
    });

    it("should construct object inheriting EventEmitter", () => {
        expect(proxy).to.be.a(BulkProxy);
        expect(proxy).to.be.an(EventEmitter);
    });

    it("should initialize properties", () => {
        expect(proxy.url).to.be(url);
        expect(proxy.flushDocuments).to.be(Infinity);
        expect(proxy.flushSize).to.be(Infinity);
        expect(proxy.retries).to.be(0);
        expect(proxy.slowThreshold).to.be(Infinity);
    });

    it("should be configurable", () => {
        proxy.changeFlushDocuments(1);
        proxy.changeFlushSize(1);
        proxy.changeRetries(1);
        proxy.changeSlowThreshold(1);

        expect(proxy.flushDocuments).to.be(1);
        expect(proxy.flushSize).to.be(1);
        expect(proxy.retries).to.be(1);
        expect(proxy.slowThreshold).to.be(1);
    });

    it("should create/maintain endpoints", () => {
        const endpoint = proxy.endpoint(index, doctype);

        expect(endpoint).to.be.a(BulkProxyEndpoint);
        expect(endpoint.proxy).to.be(proxy);
        expect(endpoint.uri).to.be(`${index}/${doctype}/_bulk`);
        expect(proxy.endpoint(index, doctype)).to.be(endpoint);
        expect(proxy.endpoint("other", "vals")).to.not.be(endpoint);
        expect(Array.from(proxy.endpoints()).length).to.be(2);
    });

    it("should emit paused/resumed events when changing state", () => {
        let paused = 0;
        let resumed = 0;

        proxy.on("paused", () => paused++);
        proxy.on("resumed", () => resumed++);

        proxy.pause();   expect(paused).to.be(1);
        proxy.pause();   expect(paused).to.be(1);
        proxy.resume();  expect(resumed).to.be(1);
        proxy.resume();  expect(resumed).to.be(1);
        proxy.pause();   expect(paused).to.be(2);
        proxy.resume();  expect(resumed).to.be(2);
    });

    it("should pass specific events from endpoint", () => {
        const endpoint = proxy.endpoint(index, doctype);
        const called = new Set();

        proxy.on("paused", passed("paused"));
        proxy.on("resumed", passed("resumed"));
        proxy.on("inserted", passed("inserted"));
        proxy.on("failed", passed("failed"));
        proxy.on("backoff", passed("backoff"));
        proxy.on("error", passed("error"));

        endpoint.emit("paused");
        endpoint.emit("resumed");
        endpoint.emit("inserted", []);
        endpoint.emit("failed", []);
        endpoint.emit("backoff");
        endpoint.emit("error", new Error("shit happens"));
        endpoint.emit("foo");

        expect(called.has("paused")).to.be(true);
        expect(called.has("resumed")).to.be(true);
        expect(called.has("inserted")).to.be(true);
        expect(called.has("failed")).to.be(true);
        expect(called.has("backoff")).to.be(true);
        expect(called.has("error")).to.be(true);
        expect(called.has("foo")).to.be(false);

        function passed(event) {
            return function(...args) {
                expect(args.pop()).to.be(endpoint);
                called.add(event);
            };
        }
    });

    it("should load documents into appropriate endpoint queue", done => {
        const id = "foobar";
        const doc = {id};

        proxy.endpoint(index, doctype).put = (...args) => {
            expect(args.length).to.be(2);
            expect(args[0]).to.be(id);
            expect(args[1]).to.be(doc);
            done();
        };

        proxy.put(index, doctype, id, doc);
    });
});
