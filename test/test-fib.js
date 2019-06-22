const expect = require("expect.js");
const fib = require("../lib/fib");

describe("fib([number], [number])", () => {
    const f0 = 23;
    const f1 = 42;
    let value;

    beforeEach(() => {
        value = fib(f0, f1);
    });

    it("should initially evaluate to first number in sequence", () => {
        expect(Number(value)).to.be(f0);
    });

    it("should iterate values with .next() method", () => {
        expect(Number(value.next())).to.be(f1);
        expect(Number(value.next())).to.be(f0+f1);
        expect(value).to.be(value.next());
    });

    it("should default f1 to f0 if non-zero", () => {
        value = fib(13);
        expect(Number(value.next())).to.be(13);
        expect(Number(value.next())).to.be(26);
    });

    it("should otherwise default to standard fibonacci", () => {
        value = fib();
        expect(Number(value.next())).to.be(1);
        expect(Number(value.next())).to.be(1);
        expect(Number(value.next())).to.be(2);
    });
});
