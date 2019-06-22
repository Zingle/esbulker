const {EventEmitter} = require("events");
const expect = require("expect.js");
const recover = require("../lib/recover");

describe("recover(BulkProxy)", () => {
    let proxy, resumed;

    beforeEach(() => {
        resumed = false;

        proxy = new EventEmitter();
        proxy.paused = true;
        proxy.breakerDocuments = Infinity;
        proxy.breakerSize = Infinity;
        proxy.endpoint = () => {};
        proxy.endpoints = function*() {};
        proxy.resume = () => resumed = true;
    });

    it("should recover proxy after being paused", async () => {
        proxy.downtime = 1;
        await recover(proxy);
        expect(resumed).to.be(true);
    });
});

describe("recover(BulkProxyEndpoint)", () => {
    let endpoint, resumed;

    beforeEach(() => {
        resumed = false;

        endpoint = new EventEmitter();
        endpoint.paused = true;
        endpoint.resume = () => resumed = true;
        endpoint.next = () => endpoint.emit("inserted", []);
    });

    it("should recover endpoint after being paused", async () => {
        endpoint.wait = 1;  // HACK: affects recovery time for testing
        await recover(endpoint);
        expect(resumed).to.be(true);
    });
});
