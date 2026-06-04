#!/usr/bin/env node

/**
 * Test runner entry point.
 *
 * Usage:
 *   node tests/run.js
 *   node tests/run.js --grep "normalize"
 *   node tests/run.js --grep "selection|expansion"
 */

import { collectTests, runTests } from "./lib/test.js";
import { resolve, dirname } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const frontendRootPath = resolve(__dirname, '..');

// Provide a minimal DOM mock so naf.js can load in Node.
// This is only needed for modules that reference `document` at import time.
setupMinimalDOM();

// Parse CLI args
const args = process.argv.slice(2);
let grepPattern = null;
let enableCoverage = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--grep" && i + 1 < args.length) {
    grepPattern = args[i + 1];
    i++;
  }
  if (args[i] === "--coverage") {
    enableCoverage = true;
  }
}

// Discover all .test.js files under tests/
const testDir = resolve(__dirname);
const testFiles = findTestFiles(testDir);

if (testFiles.length === 0) {
  console.log("No test files found.");
  process.exit(0);
}

// Import all test files (registers tests via describe/test)
for (const file of testFiles) {
  await import(file);
}

// Collect and run
const allTests = collectTests();
if (allTests.length === 0) {
  console.log("No tests registered.");
  process.exit(0);
}

console.log(`Running ${allTests.length} tests...`);
if (grepPattern) {
  console.log(`Filter: ${grepPattern}`);
}
console.log("");

const result = await runTests(allTests, { grep: grepPattern });

// Write coverage report if enabled
if (enableCoverage && globalThis.__coverage__) {
  // Include all source files in coverage report (even uncovered ones)
  const { findExecutableLines } = await import('./lib/coverage-instrument.js');
  const { readFileSync } = await import('node:fs');
  const srcDir = resolve(frontendRootPath, 'src');
  const allSourceFiles = findSourceFiles(srcDir);

  for (const filePath of allSourceFiles) {
    const relPath = filePath.replace(frontendRootPath + '/', '');
    if (!globalThis.__coverage__[relPath]) {
      const source = readFileSync(filePath, 'utf-8');
      const execLines = findExecutableLines(source);
      if (execLines.length > 0) {
        const lines = {};
        for (const n of execLines) lines[String(n)] = 0;
        globalThis.__coverage__[relPath] = { lines };
      }
    }
  }

  const { writeLcovFile } = await import('./lib/coverage-lcov.js');
  const lcovPath = resolve(__dirname, '../coverage.lcov');
  writeLcovFile(globalThis.__coverage__, lcovPath, frontendRootPath);
  console.log('');
  console.log(`Coverage report written to: ${lcovPath}`);

  // Print summary
  let totalLines = 0;
  let hitLines = 0;
  for (const [path, data] of Object.entries(globalThis.__coverage__)) {
    for (const [line, count] of Object.entries(data.lines)) {
      totalLines++;
      if (count > 0) hitLines++;
    }
  }
  const pct = totalLines > 0 ? ((hitLines / totalLines) * 100).toFixed(1) : '0.0';
  console.log(`Line coverage: ${hitLines}/${totalLines} (${pct}%)`);
}

if (result.failed > 0) {
  process.exit(1);
}
process.exit(0);

/**
 * Set up a minimal DOM mock so naf.js can load in Node.js.
 * Only provides what naf.js needs at module load time.
 */
function setupMinimalDOM() {
  /** @type {Record<string, unknown>} */
  const fakeDoc = {
    createElement() {
      return {
        style: {},
        setAttribute() {},
        removeAttribute() {},
        appendChild() {},
        removeChild() {},
        insertBefore() {},
        childNodes: [],
        children: [],
        textContent: "",
        innerHTML: "",
        className: "",
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        focus() {},
        blur() {},
        click() {},
        dispatchEvent() { return true; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        getElementsByTagName() { return []; },
        getElementsByClassName() { return []; },
        getAttribute() { return null; },
        hasAttribute() { return false; },
      };
    },
    createTextNode() {
      return { nodeValue: "", textContent: "" };
    },
    createDocumentFragment() {
      return {
        appendChild() {},
        childNodes: [],
      };
    },
  };

  globalThis.document = fakeDoc;
  globalThis.window = {
    ...globalThis.window,
    document: fakeDoc,
    localStorage: null,
    go: undefined,
    runtime: undefined,
  };
}

/**
 * Recursively find all .test.js files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function findTestFiles(dir) {
  /** @type {string[]} */
  const results = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && entry !== "lib" && entry !== "browser") {
      results.push(...findTestFiles(fullPath));
    } else if (stat.isFile() && entry.endsWith(".test.js")) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

/**
 * Recursively find all .js files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function findSourceFiles(dir) {
  /** @type {string[]} */
  const results = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findSourceFiles(fullPath));
    } else if (stat.isFile() && entry.endsWith(".js")) {
      results.push(fullPath);
    }
  }

  return results.sort();
}
