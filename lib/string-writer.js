const {Writable} = require("stream");
const {assign} = Object;

/**
 * Create writable stream that evaluates to aggregated string data.
 * @returns {Writable}
 */
function stringWriter() {
    const chunks = [];
    const writable = new Writable({write});

    return assign(writable, {toString});

    function write(chunk, encoding, done) {
        chunks.push(chunk);
        done();
    }

    function toString() {
        if (chunks.length > 1) {
            chunks.splice(0, chunks.length, Buffer.concat(chunks));
        }

        return chunks[0] ? chunks[0].toString("utf8") : "";
    }
}

module.exports = stringWriter;
