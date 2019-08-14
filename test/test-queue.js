const expect = require("expect.js");
const Queue = require("../lib/queue");

const {abs} = Math;
const {registry} = Queue[Queue.internal];
const {calculateSize} = Queue;

describe("queue(string, string)", () => {
    const esurl = "http://es.example.com:9200";
    const quri = "index/doctype/_bulk";
    const doctype = "doctype";
    const id = "blargh";
    const header = {doctype, id};
    const body = {foo: "bang"};

    beforeEach(() => {
        registry.clear();
        console.debug = () => {};
    });

    afterEach(() => {
        delete console.debug;
    });

    it("should return a queue function", () => {
        expect(Queue(esurl, quri)).to.be.a("function");
    });

    it("should initialize queue", () => {
        const queue = Queue(esurl, quri);
        const t0 = Date.now();

        expect(queue.url).to.be(`${esurl}/${quri}`);
        expect(queue.age).to.be(0);
        expect(queue.length).to.be(0);
        expect(queue.size).to.be(0);
        expect(queue.oldest).to.not.be.lessThan(t0);
        expect(queue.oldest).to.not.be.greaterThan(Date.now());
    });

    it("should push items into queue", () => {
        const queue = Queue(esurl, quri);
        const t0 = Date.now();

        queue(header, body);

        expect(queue.age).to.not.be.lessThan(0);
        expect(queue.length).to.be(1);
        expect(queue.size).to.be.greaterThan(0);
        expect(queue.oldest).to.not.be.lessThan(t0);
        expect(queue.oldest).to.not.be.greaterThan(Date.now());
    });

    it("should add new entry in internal queue registry", () => {
        expect(registry.size).to.be(0);

        const queue = Queue(esurl, quri);
        const {url} = queue;

        expect(registry.size).to.be(1);
        expect(registry.has(url)).to.be(true);
        expect(registry.get(url)).to.be(queue);
    });
});

describe("Queue#shiftn(number)", () => {
    const esurl = "http://es.example.com:9200";
    const quri = "index/doctype/_bulk";
    const doctype = "doctype";
    const id = "blargh";
    const header = {doctype, id};
    const body = {foo: "bang"};

    beforeEach(() => {
        registry.clear();
        console.debug = () => {};
    });

    afterEach(() => {
        delete console.debug;
    });

    it("should shift n items from queue", () => {
        const queue = Queue(esurl, quri);

        queue(header, body);

        const shifted = queue.shiftn(1);

        expect(queue.length).to.be(0);
        expect(queue.size).to.be(0);
        expect(shifted).to.be.an("array");
        expect(shifted.length).to.be(1);

        const empty = queue.shiftn(5);

        expect(empty.length).to.be(0);
    });
});

describe("calculateSize()", () => {
    const entryA = {size: 4};
    const entryB = {size: 2};
    const entryC = {size: 7};

    beforeEach(() => {
        registry.clear();
        registry.set("a", entryA);
        registry.set("b", entryB);
        registry.set("c", entryC);
    });

    it("should sum size of all entries in registry", () => {
        expect(calculateSize()).to.be(entryA.size + entryB.size + entryC.size);
    });
});
