const stream = require("stream");

/**
 * Polyfill Readable stream with new .from method.
 */
function polyfillReadable() {
    stream.Readable.from = (iterable) => {
        const iterator = iterable[Symbol.iterator]();

        return new stream.Readable({
            read() {
                const {value, done} = iterator.next();
                this.push(done ? null : value);
            }
        })
    }
}

if (!stream.Readable.from) polyfillReadable();
