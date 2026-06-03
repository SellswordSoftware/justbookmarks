// @ts-check

/**
 * Minimal assertion library for justbookmarks tests.
 * No dependencies -- works in Node and browser.
 */

class AssertionError extends Error {
  /**
   * @param {string} message
   * @param {{ actual: unknown, expected?: unknown }} [details]
   */
  constructor(message, details) {
    super(message);
    this.name = "AssertionError";
    this.actual = details?.actual;
    this.expected = details?.expected;
  }
}

/**
 * @param {unknown} value
 * @param {string} [message]
 */
export function ok(value, message) {
  if (!value) {
    throw new AssertionError(
      message ? `${message}: expected truthy, got ${format(value)}` : `expected truthy, got ${format(value)}`,
      { actual: value },
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} [message]
 */
export function notOk(value, message) {
  if (value) {
    throw new AssertionError(
      message ? `${message}: expected falsy, got ${format(value)}` : `expected falsy, got ${format(value)}`,
      { actual: value },
    );
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [message]
 */
export function equal(actual, expected, message) {
  if (actual != expected) {
    throw new AssertionError(
      message ? `${message}: expected ${format(expected)} != ${format(actual)}` : `expected ${format(expected)} == ${format(actual)}`,
      { actual, expected },
    );
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [message]
 */
export function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new AssertionError(
      message ? `${message}: expected ${format(expected)} !== ${format(actual)}` : `expected ${format(expected)} === ${format(actual)}`,
      { actual, expected },
    );
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [message]
 */
export function deepEqual(actual, expected, message) {
  if (!deepEquals(actual, expected)) {
    throw new AssertionError(
      message ? `${message}: deep equal failed` : `deep equal failed`,
      { actual, expected },
    );
  }
}

/**
 * @param {() => unknown} fn
 * @param {Function | string | undefined} [predicate]
 * @param {string} [message]
 */
export function throws(fn, predicate, message) {
  /** @type {Error | null} */
  let caught = null;
  try {
    fn();
  } catch (e) {
    caught = /** @type {Error} */ (e);
  }

  if (!caught) {
    throw new AssertionError(
      message ? `${message}: expected function to throw` : "expected function to throw",
    );
  }

  if (predicate !== undefined) {
    if (typeof predicate === "function") {
      // Error subclass -- check instanceof
      if (!(caught instanceof predicate)) {
        throw new AssertionError(
          message ? `${message}: expected ${predicate.name} but got ${caught.constructor.name}` :
            `expected ${predicate.name} but got ${caught.constructor.name}`,
          { actual: caught.constructor.name, expected: predicate.name },
        );
      }
    } else if (typeof predicate === "string") {
      // String -- check if message includes it
      if (!caught.message.includes(predicate)) {
        throw new AssertionError(
          message ? `${message}: expected message to include "${predicate}" but got "${caught.message}"` :
            `expected message to include "${predicate}" but got "${caught.message}"`,
          { actual: caught.message, expected: predicate },
        );
      }
    }
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @returns {boolean}
 */
function deepEquals(actual, expected) {
  if (actual === expected) {
    return true;
  }

  if (actual === null || expected === null) {
    return actual === expected;
  }

  if (typeof actual !== typeof expected) {
    return false;
  }

  if (typeof actual === "object") {
    const exp = /** @type {unknown} */ (expected);
    if (Array.isArray(actual) !== Array.isArray(exp)) {
      return false;
    }

    if (Array.isArray(actual)) {
      const expArr = /** @type {unknown[]} */ (exp);
      if (actual.length !== expArr.length) {
        return false;
      }
      for (let i = 0; i < actual.length; i++) {
        if (!deepEquals(actual[i], expArr[i])) {
          return false;
        }
      }
      return true;
    }

    const expObj = /** @type {Record<string, unknown>} */ (exp);
    const actObj = /** @type {Record<string, unknown>} */ (actual);
    const aKeys = Object.keys(actObj);
    const eKeys = Object.keys(expObj);
    if (aKeys.length !== eKeys.length) {
      return false;
    }

    for (const key of aKeys) {
      if (!Object.hasOwn(expObj, key)) {
        return false;
      }
      if (!deepEquals(actObj[key], expObj[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function format(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (Array.isArray(value)) return `[${value.map(format).join(", ")}]`;
  return JSON.stringify(value);
}

export { AssertionError };
