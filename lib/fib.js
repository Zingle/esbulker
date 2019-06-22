/**
 * Create fibonacci value.
 * @param {number} [f0]
 * @param {number} [f1]
 */
function fib(f0, f1=f0) {
    if (arguments.length === 0) [f0, f1] = [0, 1];
    if (arguments.length === 1) f1 = f0;
    if (f0 === 0 && f1 === 0) f1 = 1;

    let [m, n] = [f0, f1];

    return {
        valueOf() { return m; },
        next() { [m, n] = [n, m+n]; return this; }
    }
}

module.exports = fib;
