// @ts-check

/**
 * Lcov format writer.
 *
 * Converts the __coverage__ data structure (produced by the instrumentation
 * engine) into standard lcov format text. Lcov is a plain text format
 * consumable by VS Code extensions (Coverage Gutters), codecov, gcovr, etc.
 */

import { writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

/**
 * Convert __coverage__ data to lcov format text.
 *
 * @param {object} coverage  The globalThis.__coverage__ object
 * @param {string} basePath  Filesystem base path for resolving source paths
 * @returns {string} Lcov format text
 */
export function coverageToLcov(coverage, basePath) {
  const records = [];

  for (const [sourcePath, data] of Object.entries(coverage)) {
    const lines = data.lines;
    if (!lines || Object.keys(lines).length === 0) continue;

    // Resolve the source file path relative to basePath
    const fullPath = resolve(basePath, sourcePath);
    const relPath = relative(basePath, fullPath);

    // Count total lines and hit lines, build DA lines
    let hitLines = 0;
    let totalLines = 0;
    /** @type {string[]} */
    const daLines = [];

    // Sort line numbers numerically for consistent output
    const sortedLineNums = Object.keys(lines).sort((a, b) => Number(a) - Number(b));

    for (const lineNum of sortedLineNums) {
      const count = lines[lineNum];
      totalLines++;
      if (count > 0) hitLines++;
      daLines.push(`DA:${lineNum},${count}`);
    }

    const record = [
      `TN:coverage`,
      `SF:${relPath}`,
      ...daLines,
      `LF:${totalLines}`,
      `LH:${hitLines}`,
      `end_of_record`,
    ];

    records.push(record.join('\n'));
  }

  return records.join('\n') + '\n';
}

/**
 * Write coverage data to an lcov file.
 *
 * @param {object} coverage  The globalThis.__coverage__ object
 * @param {string} outputPath  Path to write lcov file
 * @param {string} basePath  Filesystem base path for resolving source paths
 * @returns {string} Path to the written file
 */
export function writeLcovFile(coverage, outputPath, basePath) {
  const lcovText = coverageToLcov(coverage, basePath);
  writeFileSync(outputPath, lcovText, 'utf-8');
  return outputPath;
}
