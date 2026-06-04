// @ts-check
// Manual verification of the instrumentation engine.
// Run with: node tests/lib/coverage-instrument.test.manual.js

import { instrument, findExecutableLines } from './coverage-instrument.js';

console.log('=== Test 1: Simple function ===');
const simple = 'export function add(a, b) {\n  return a + b;\n}';
const result1 = instrument(simple, 'test.js');
console.log(result1);
console.log();

console.log('=== Test 2: Multiple functions ===');
const multi = 'function foo() {\n  return 1;\n}\nexport function bar() {\n  const x = 2;\n  return x;\n}';
const result2 = instrument(multi, 'test.js');
console.log(result2);
console.log();

console.log('=== Test 3: Arrow function ===');
const arrow = 'const fn = (x) => {\n  return x * 2;\n};';
const result3 = instrument(arrow, 'test.js');
console.log(result3);
console.log();

console.log('=== Test 4: Module-level code ===');
const modLevel = 'import { x } from "./x.js";\nconst y = x + 1;\nexport { y };';
const result4 = instrument(modLevel, 'test.js');
console.log(result4);
console.log();

console.log('=== Test 5: Executable line detection ===');
const withComments = `// @ts-check

/**
 * A function
 */
export function foo() {
  return 1;
}

// comment line
`;
console.log(findExecutableLines(withComments));
console.log('Expected: [6, 7] (function declaration + return)');
