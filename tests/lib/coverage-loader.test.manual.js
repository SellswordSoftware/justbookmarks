// @ts-check
// Verify the loader actually instruments and collects coverage.
// Run with: node --experimental-loader file://path/to/coverage-loader.js tests/lib/coverage-loader.test.manual.js

import { normalizeTree } from '../../src/features/tree/state/normalize.js';

// Run a simple test
normalizeTree([{
  type: 1,
  bookmark: { id: 'b1', title: 'Test' },
}]);

console.log('=== Coverage data ===');
const cov = globalThis.__coverage__;
if (cov) {
  console.log(JSON.stringify(cov, null, 2));
} else {
  console.log('NO COVERAGE DATA - loader may not be active');
}
