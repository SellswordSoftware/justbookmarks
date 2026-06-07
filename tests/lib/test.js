// @ts-check

/**
 * Minimal test framework for justbookmarks.
 *
 * API:
 *   describe(name, fn)              -- Group tests. Nestable.
 *   test(name, fn)                  -- Define a test.
 *   test.skip(name, fn)             -- Skip a test.
 *   test.only(name, fn)             -- Run only this test (and other .only tests).
 *   test.beforeEach(fn)             -- Hook before each test in current suite.
 *   test.afterEach(fn)              -- Hook after each test in current suite.
 *
 * Runner:
 *   collectTests()                  -- Returns all registered tests.
 *   runTests(tests, options)        -- Execute tests, return results.
 */

/**
 * @typedef {object} TestDescriptor
 * @property {string} name
 * @property {() => void | Promise<void>} fn
 * @property {boolean} skipped
 * @property {boolean} only
 */

/**
 * @typedef {object} TestResult
 * @property {string} name
 * @property {"passed" | "failed" | "skipped"} status
 * @property {number} duration
 * @property {string} [error]
 */

/**
 * @typedef {object} RunOptions
 * @property {string | null} [grep]
 * @property {(msg: string) => void} [log]
 */

/** @type {TestDescriptor[]} */
const tests = [];

/** @type {string} */
let currentSuite = "";

/** @type {Array<() => void | Promise<void>>} */
let beforeEachHooks = [];

/** @type {Array<() => void | Promise<void>>} */
let afterEachHooks = [];

/**
 * @param {string} name
 * @param {() => void} fn
 */
export function describe(name, fn) {
  const parentSuite = currentSuite;
  currentSuite = currentSuite ? `${currentSuite}/${name}` : name;
  fn();
  currentSuite = parentSuite;
}

/**
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
export function test(name, fn) {
  tests.push({
    name: currentSuite ? `${currentSuite}: ${name}` : name,
    fn,
    skipped: false,
    only: false,
  });
}

/**
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
test.skip = function (name, fn) {
  tests.push({
    name: currentSuite ? `${currentSuite}: ${name}` : name,
    fn,
    skipped: true,
    only: false,
  });
};

/**
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
test.only = function (name, fn) {
  tests.push({
    name: currentSuite ? `${currentSuite}: ${name}` : name,
    fn,
    skipped: false,
    only: true,
  });
};

/**
 * @param {() => void | Promise<void>} fn
 */
test.beforeEach = function (fn) {
  beforeEachHooks.push(fn);
};

/**
 * @param {() => void | Promise<void>} fn
 */
test.afterEach = function (fn) {
  afterEachHooks.push(fn);
};

/** @returns {TestDescriptor[]} */
export function collectTests() {
  return tests;
}

/**
 * @param {TestDescriptor[]} allTests
 * @param {RunOptions} [options]
 * @returns {Promise<{ passed: number, failed: number, skipped: number, results: TestResult[] }>}
 */
export async function runTests(allTests, options = {}) {
  const log = options.log ?? console.log;
  const grep = options.grep;

  // Filter: if any .only tests exist, only run those
  let runnable = allTests;
  const hasOnly = allTests.some((t) => t.only);
  if (hasOnly) {
    runnable = allTests.filter((t) => t.only);
  }

  // Filter: if grep pattern provided, match by name
  if (grep) {
    const pattern = new RegExp(grep, "i");
    runnable = runnable.filter((t) => pattern.test(t.name));
  }

  /** @type {TestResult[]} */
  const results = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const wallStart = performance.now();

  for (const t of runnable) {
    if (t.skipped) {
      skipped++;
      results.push({ name: t.name, status: "skipped", duration: 0 });
      log(`  SKIP ${t.name}`);
      continue;
    }

    const start = performance.now();
    try {
      for (const hook of beforeEachHooks) {
        await hook();
      }
      await t.fn();
      for (const hook of afterEachHooks) {
        await hook();
      }
      const duration = performance.now() - start;
      passed++;
      results.push({ name: t.name, status: "passed", duration });
      log(`  PASS ${t.name} (${duration.toFixed(1)}ms)`);
    } catch (e) {
      const duration = performance.now() - start;
      failed++;
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ name: t.name, status: "failed", duration, error: errMsg });
      log(`  FAIL ${t.name} (${duration.toFixed(1)}ms)`);
      log(`    ${errMsg}`);
      if (e instanceof Error && e.stack) {
        const lines = e.stack.split("\n").slice(1, 4);
        for (const line of lines) {
          log(`    ${line.trim()}`);
        }
      }
    }
  }

  const wallDuration = performance.now() - wallStart;

  log("");
  log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped (${allTests.length} total) in ${wallDuration.toFixed(0)}ms`);

  return { passed, failed, skipped, results };
}
