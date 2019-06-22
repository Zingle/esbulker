const expect = require("expect.js");
const readopts = require("../lib/readopts");

describe("readopts(string[])", () => {
    let args;

    beforeEach(() => {
        args = [
            "node", "esbulker",
            "--flush-docs=13",
            "--flush-size=10",
            "--help",
            "http://localhost:9200"
        ];
    });

    it("should recognize options", () => {
        const options = readopts(args);

        expect(options.flushDocuments).to.be(13);
        expect(options.flushSize).to.be(10);
        expect(options.help).to.be(true);
    });

    it("should stop parsing after --help", () => {
        [args[3], args[4]] = [args[4], [args[3]]];

        const options = readopts(args);

        expect(options.flushDocuments).to.be(13);
        expect(options.help).to.be(true);
        expect(options.flushSize).to.be(Infinity);
    });
});
