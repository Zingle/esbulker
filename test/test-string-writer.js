const expect = require("expect.js");
const stringWriter = require("../lib/string-writer");

describe("stringWriter()", () => {
    it("should create Writable that evaluates as UTF8 string", () => {
        const writer = stringWriter();

        writer.write(Buffer.from("foo", "utf8"));
        writer.write(Buffer.from("bar", "utf8"));

        expect(String(writer)).to.be("foobar");

        writer.write("baz");

        expect(String(writer)).to.be("foobarbaz");
    });
});
