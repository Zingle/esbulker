const expect = require("expect.js");
const sleep = require("../lib/sleep");

describe("async sleep(number)", () => {
    it("should resolve", done => {
        sleep(10).then(done);
    });

    it("should resolve after delay", async () => {
        const now = Date.now();
        await sleep(35);
        expect(Date.now() - now).to.not.be.lessThan(35);
    });
});
