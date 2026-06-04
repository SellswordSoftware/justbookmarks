// @ts-check
// Manual verification of the lcov writer.

import { coverageToLcov } from './coverage-lcov.js';

const fakeCoverage = {
  'src/features/tree/state/normalize.js': {
    lines: { '38': 5, '39': 5, '40': 1, '43': 4, '44': 4, '45': 4 },
  },
  'src/features/tree/state/selection.js': {
    lines: { '34': 10, '35': 10, '36': 10, '43': 0, '44': 0 },
  },
};

const lcov = coverageToLcov(fakeCoverage, '/home/mike/sellsword/justbookmarks/frontend');
console.log(lcov);

// Verify format
const lines = lcov.split('\n');
console.log('=== Format verification ===');
console.log('Has TN:', lines.some(l => l.startsWith('TN:')));
console.log('Has SF:', lines.some(l => l.startsWith('SF:')));
console.log('Has DA:', lines.some(l => l.startsWith('DA:')));
console.log('Has LF:', lines.some(l => l.startsWith('LF:')));
console.log('Has LH:', lines.some(l => l.startsWith('LH:')));
console.log('Has end_of_record:', lines.some(l => l === 'end_of_record'));
console.log('Records count:', lines.filter(l => l === 'end_of_record').length);
