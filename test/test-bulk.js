const http = require("http");
const expect = require("expect.js");
const bulk = require("../lib/bulk");
const {all: queues} = require("../lib/queue");

describe("bulk(string, Header, object)", () => {
    const index = "idx";
    const doctype = "whatzit";
    const id = "fizz";
    const simpleHeader = {index, doctype, id};
    const sizeHeader = {index, doctype: "size", id};
    const trueHeader = {index, doctype, id, refresh: "true"};
    const waitHeader = {index, doctype, id, refresh: "wait_for"};

    let esurl, trueurl, waiturl, typeurl, sizeurl, server;

    beforeEach(done => {
        server = http.createServer((req, res) => {
            res.end();
        });

        server.listen(() => {
            const {port} = server.address();
            esurl = `http://localhost:${port}`;
            trueurl = `${esurl}/${index}/_bulk?refresh=true`;
            waiturl = `${esurl}/${index}/_bulk?refresh=wait_for`;
            typeurl = `${esurl}/${index}/${doctype}/_bulk`;
            sizeurl = `${esurl}/${index}/size/_bulk`;
            done();
        });

        console.http = () => {};
        console.debug = () => {};
        console.info = () => {};
        console.warn = () => {};
        console.error = () => {};
    });

    afterEach(() => {
        server.close();
        delete console.http;
        delete console.debug;
        delete console.info;
        delete console.warn;
        delete console.error;
    });

    it("should create document queue without refresh", async () => {
        let found = false;
        await bulk(esurl, simpleHeader, {id});
        for (let queue of queues()) if (queue.url == typeurl) found = true;
        expect(found).to.be(true);
    });

    it("should create separate queue for refresh=true", async () => {
        let found = false;
        await bulk(esurl, trueHeader, {id});
        for (let queue of queues()) if (queue.url === trueurl) found = true;
        expect(found).to.be(true);
    });

    it("should create separate queue for refresh=wait_for", async () => {
        let found = false;
        await bulk(esurl, waitHeader, {id});
        for (let queue of queues()) if (queue.url === waiturl) found = true;
        expect(found).to.be(true);
    });

    it("should update the length and size of queue", async () => {
        let found = false;

        const pending = bulk(esurl, sizeHeader, {id});

        for (let queue of queues()) if (queue.url === sizeurl) {
            found = queue;
            expect(queue.length).to.be(1);
            expect(queue.size).to.be.greaterThan(0);
        }

        await pending;

        expect(found).to.be.ok();
        expect(found.length).to.be(0);
        expect(found.size).to.be(0);
    });
});
