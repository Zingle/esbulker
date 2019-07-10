const {assign, defineProperties} = Object;
const queues = new Map();

module.exports = assign(queue, {all});

/**
 * Lookup existing queue for supplied arguments or create one.
 * @param {string} esurl
 * @param {string} uri
 * @returns {Queue}
 */
function queue(esurl, uri) {
    const url = `${esurl}/${uri}`;

    if (!queues.has(url)) {
        queues.set(url, createQueue(esurl, uri));
    }

    return queues.get(url);
}

/**
 * Create Elasticsearch bulk queue.
 * @param {string} esurl
 * @param {string} uri
 * @returns {Queue}
 */
function createQueue(esurl, uri) {
    const url = `${esurl}/${uri}`;
    const items = [];
    let size = 0;

    assign(queue, {shift});

    defineProperties(queue, {
        url: {enumerable: true, get: () => url},
        age: {enumerable: true, get: () => age()},
        length: {enumerable: true, get: () => items.length},
        oldest: {enumerable: true, get: () => oldest()},
        size: {enumerable: true, get: () => size}
    });

    return queue;

    function queue(header, body) {
        const {doctype, id} = header;
        const when = Date.now();
        const action = index(uri, header);
        const data = JSON.stringify(action) + "\n" + JSON.stringify(body) + "\n";

        items.push({when, header, data});
        size += data.length;

        console.debug(`queued ${doctype}/${id} for ${uri}`);
    }

    function age() {
        const now = Date.now();
        return now - (items[0] || {when:now}).when;
    }

    function oldest() {
        return items[0] ? items[0].when : Date.now();
    }

    function shift() {
        if (items.length) size -= items[0].data.length;
        return items.shift();
    }
}

/**
 * Iterate over all known queues.
 * @yields {Queue}
 */
function* all() {
    yield* queues.values();
}

/**
 * Generate Elasticsearch index action for a bulk URI and index request header.
 * @param {string} uri
 * @param {Header} header
 * @returns {object}
 */
function index(uri, header) {
    const {index, doctype, id, parent} = header;
    const [indexpart, typepart] = uri.split("/");
    const action = {index: {_id: id}};

    if (!typepart || typepart[0] === "_") {
        action.index._type = doctype;
        action.index._index = index;
    } else if (!indexpart || indexpart[0] === "_") {
        action.index._index = index;
    }

    if (parent) {
        action.index._parent = parent;
    }

    return action;
}

/**
 * @typedef {function} Queue
 * @property {string} url
 * @property {number} age
 * @property {number} length
 * @property {number} oldest
 * @property {number} size
 */

/**
 * @name Queue.shift
 * @returns {Item}
 */

/**
 * @typedef {object} Item
 * @property {number} when
 * @property {Header} header
 * @property {string} data
 */
