const expect = require("expect.js");
const nock = require("nock");
const bulk = require("../lib/bulk");
const Queue = require("../lib/queue");

const {values} = Object;
const {registry: queues} = Queue[Queue.internal];

describe("bulk(string, Header, object)", () => {
    const esurl = "http://es.example.com:9200";
    const index = "idx";
    const id = "fizz";
    const doctype = "whatzit";

    const trueuri = `${index}/_bulk?refresh=true`;
    const waituri = `${index}/_bulk?refresh=wait_for`;
    const typeuri = `${index}/${doctype}/_bulk`;
    const sizeuri = `${index}/size/_bulk`;

    const trueurl = `${esurl}/${trueuri}`;
    const waiturl = `${esurl}/${waituri}`;
    const typeurl = `${esurl}/${typeuri}`;
    const sizeurl = `${esurl}/${sizeuri}`;

    const simpleHeader = {index, doctype, id};
    const sizeHeader = {index, doctype: "size", id};
    const trueHeader = {index, doctype, id, refresh: "true"};
    const waitHeader = {index, doctype, id, refresh: "wait_for"};

    beforeEach(() => {
        console.http = () => {};
        console.debug = () => {};
        console.info = () => {};
        console.warn = () => {};
        console.error = () => {};
    });

    afterEach(() => {
        delete console.http;
        delete console.debug;
        delete console.info;
        delete console.warn;
        delete console.error;
    });

    it("should create document queue without refresh", async () => {
        const es = nock(esurl).post(`/${typeuri}`).reply(202);
        await bulk(esurl, simpleHeader, {id});
        expect(queues.has(typeurl)).to.be(true);
    });

    it("should create separate queue for refresh=true", async () => {
        const es = nock(esurl).post(`/${trueuri}`).reply(200);
        await bulk(esurl, trueHeader, {id});
        expect(queues.has(trueurl)).to.be(true);
    });

    it("should create separate queue for refresh=wait_for", async () => {
        const es = nock(esurl).post(`/${waituri}`).reply(200);
        await bulk(esurl, waitHeader, {id});
        expect(queues.has(waiturl)).to.be(true);
    });

    it("should update the length and size of queue", async () => {
        const es = nock(esurl).post(`/${sizeuri}`).reply(202);
        const pending = bulk(esurl, sizeHeader, {id});

        expect(queues.has(sizeurl)).to.be(true);
        expect(queues.get(sizeurl).length).to.be(1);
        expect(queues.get(sizeurl).size).to.be.greaterThan(0);

        await pending;

        expect(queues.has(sizeurl)).to.be(true);
        expect(queues.get(sizeurl).length).to.be(0);
        expect(queues.get(sizeurl).size).to.be(0);
    });
});
