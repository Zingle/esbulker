const expect = require("expect.js");
const {spy} = require("sinon");
const {defaults, readargs, readenv} = require("../lib/config");

describe("defaults()", () => {
    it("should return valid defaults", () => {
        const options = defaults();

        expect(options.breakerDocuments).to.be.a("number");
        expect(options.breakerSize).to.be.a("number");
        expect(options.flushDocuments).to.be.a("number");
        expect(options.flushSize).to.be.a("number");
        expect(options.port).to.be.a("number");
        expect(options.retries).to.be.a("number");
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
            "--break-docs=12",
            "--break-size=300",
            "--flush-docs=13",
            "--flush-size=10MiB",
            "--http-log=foo",
            "--ip=::1",
            "--port=13",
            "--retry=2",
            "--slow=3",
            "--help",
            "--version",
            "http://localhost:9200"
        ];
    });

    afterEach(() => {
        process.exit = exit;
        delete console.log;
    });

    it("should recognize options", () => {
        const options = readargs(args);

        expect(options.breakerDocuments).to.be(12);
        expect(options.breakerSize).to.be(300);
        expect(options.flushDocuments).to.be(13);
        expect(options.flushSize).to.be(10485760);
        expect(options.httpLog).to.be("foo");
        expect(options.address).to.be("::1");
        expect(options.port).to.be(13);
        expect(options.retries).to.be(2);
        expect(options.slow).to.be(3);
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
            BREAK_DOCS: "12",
            BREAK_SIZE: "300",
            FLUSH_DOCS: "13",
            FLUSH_SIZE: "10MiB",
            HTTP_LOG: "foo",
            LISTEN_ADDR: "::1",
            LISTEN_PORT: "13",
            REQ_RETRIES: 2,
            SLOW_INSERT: 3
        };
    });

    it("should recognize environment variables", () => {
        const options = readenv(env);

        expect(options.breakerDocuments).to.be(12);
        expect(options.breakerSize).to.be(300);
        expect(options.flushDocuments).to.be(13);
        expect(options.flushSize).to.be(10485760);
        expect(options.httpLog).to.be("foo");
        expect(options.address).to.be("::1");
        expect(options.port).to.be(13);
        expect(options.retries).to.be(2);
        expect(options.slow).to.be(3);
    });
});
