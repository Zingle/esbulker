const expect = require("expect.js");
const {spy} = require("sinon");
const {defaults, readargs, readenv} = require("../lib/config");

describe("defaults()", () => {
    it("should return valid defaults", () => {
        const options = defaults();

        expect(options.address).to.be(undefined);
        expect(options.port).to.be.a("number");
        expect(options.secure).to.be(false);
        expect(options.tls).to.be(null);
        expect(options.url).to.be.a("string");
        expect(options.verbosity).to.be.a("number");
    });
});

describe("readargs(string[])", () => {
    let args, exit;

    beforeEach(() => {
        exit = process.exit;
        process.exit = spy();
        console.log = () => {};

        args = [
            "node", "esbulker",
            "--es=http://localhost:9201",
            "--ip=::1",
            "--port=13"
        ];
    });

    afterEach(() => {
        process.exit = exit;
        delete console.log;
    });

    it("should recognize options", () => {
        console.log("ittt");
        const options = readargs(args);
        delete console.log;

        expect(options.url).to.be("http://localhost:9201");
        expect(options.address).to.be("::1");
        expect(options.port).to.be(13);
    });

    it("should exit after --help", () => {
        const options = readargs(["node", "script", "--help"]);
        expect(process.exit.calledOnce).to.be(true);
    });

    it("should exit after --version", () => {
        const options = readargs(["node", "script", "--version"]);
        expect(process.exit.calledOnce).to.be(true);
    });
});

describe("readenv(object)", () => {
    let env;

    beforeEach(() => {
        env = {
            ES_URL: "http://localhost:9201",
            LISTEN_ADDR: "::1",
            LISTEN_PORT: "13"
        };
    });

    it("should recognize environment variables", () => {
        const options = readenv(env);

        expect(options.url).to.be("http://localhost:9201");
        expect(options.address).to.be("::1");
        expect(options.port).to.be(13);
    });
});
