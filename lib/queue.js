const {assign, defineProperties, values} = Object;
const registry = new Map();
const internal = Symbol();

module.exports = assign(queue, {calculateSize, internal, [internal]: {registry}});

/**
 * Lookup existing queue for supplied arguments or create one.
 * @param {string} esurl
 * @param {string} uri
 * @returns {Queue}
 */
function queue(esurl, uri) {
    const url = `${esurl}/${uri}`;

    if (!registry.has(url)) {
        registry.set(url, createQueue(esurl, uri));
    }

    return registry.get(url);
}

/**
 * Calculate the total queue size.
 * @returns {number}
 */
function calculateSize() {
    return Array.from(values(registry)).reduce((a,b) => a+b.size, 0);
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

    assign(queue, {shiftn, items: function*() { yield* items; }});

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

    function shiftn(n) {
        const shifted = items.splice(0, n);
        size -= shifted.map(item => item.data.length).reduce((a,b) => a+b, 0);
        return shifted;
    }
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
 * @name Queue.shiftn
 * @type {function}
 * @param {number} n
 * @returns {Item}
 */

/**
 * @typedef {object} Item
 * @property {number} when
 * @property {Header} header
 * @property {string} data
 */
