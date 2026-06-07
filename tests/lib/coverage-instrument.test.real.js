// @ts-check
// Test instrumentation against a real source file and verify it executes.

import { instrument } from './coverage-instrument.js';
import { readFileSync } from 'node:fs';

// Read a real source file
const source = readFileSync('./src/features/tree/state/normalize.js', 'utf-8');

console.log('=== Instrumenting normalize.js ===');
const instrumented = instrument(source, 'src/features/tree/state/normalize.js');
console.log(instrumented.slice(0, 1500));
console.log('...');
console.log();

// Verify it actually runs and produces coverage data
console.log('=== Execution test ===');
// Clear any previous coverage
delete globalThis.__coverage__;

// Create a simple instrumented module and eval it
const testSource = `
export function add(a, b) {
  return a + b;
}
export function mul(a, b) {
  return a * b;
}
`;
const instrumentedTest = instrument(testSource, 'inline.js');

// Eval the code in a way that exposes functions to globalThis
// Remove 'export' keyword, wrap in IIFE to capture function refs
const evalCode = instrumentedTest
  .replace(/^export /gm, '')
  .replace(/^var __cov__/gm, 'var __cov__');

/** @type {{ add: Function, mul: Function }} */
const refs = {};
const wrapped = `(function(exports){${evalCode}; exports.add=add; exports.mul=mul; return exports;})({})`;
Object.assign(globalThis, eval(wrapped));

// Call only add(), not mul()
globalThis.add(1, 2);

console.log('Coverage after calling add(1, 2):');
console.log(JSON.stringify(globalThis.__coverage__, null, 2));
console.log();

// mul should NOT be covered
/** @type {object} */
const coverage = globalThis.__coverage__['inline.js'];
if (coverage) {
  console.log('Line 2 (add declaration):', coverage.lines['2'] || 0, '(should be 1)');
  console.log('Line 3 (add body):', coverage.lines['3'] || 0, '(should be 1)');
  console.log('Line 5 (mul declaration):', coverage.lines['5'] || 0, '(should be 0)');
  console.log('Line 6 (mul body):', coverage.lines['6'] || 0, '(should be 0)');
}
