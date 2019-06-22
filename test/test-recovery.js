const {EventEmitter} = require("events");
const expect = require("expect.js");
const recover = require("../lib/recover");

describe("recover(BulkProxyEndpoint)", () => {
    let endpoint, resumed;

    beforeEach(() => {
        resumed = false;

        endpoint = new EventEmitter();
        endpoint.paused = true;
        endpoint.resume = () => resumed = true;
        endpoint.next = () => endpoint.emit("result", true);
    });

    it("should recover endpoint after being paused", async () => {
        await recover(endpoint, 0);
        expect(resumed).to.be(true);
    });
});
