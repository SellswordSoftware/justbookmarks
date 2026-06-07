// @ts-check

/**
 * Lcov file merger.
 *
 * Merges multiple lcov files into one. When the same source file appears in
 * multiple inputs, execution counts are summed.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Merge multiple lcov files into one.
 *
 * @param {string[]} inputPaths  Paths to lcov files to merge
 * @param {string} outputPath    Path to write merged lcov file
 * @returns {string} Path to the merged file
 */
export function mergeLcovFiles(inputPaths, outputPath) {
  /** @type {Map<string, Map<string, number>>} */
  const merged = new Map();

  for (const inputPath of inputPaths) {
    const content = readFileSync(inputPath, 'utf-8');
    const records = content.split('end_of_record').filter(r => r.trim());

    for (const record of records) {
      const lines = record.split('\n');
      /** @type {string | null} */
      let sf = null;
      /** @type {Map<string, number>} */
      const da = new Map();

      for (const line of lines) {
        if (line.startsWith('SF:')) sf = line.slice(3);
        if (line.startsWith('DA:') && sf) {
          const parts = line.slice(3).split(',');
          const num = parts[0];
          const count = parseInt(parts[1], 10);
          da.set(num, (da.get(num) || 0) + count);
        }
      }

      if (sf) {
        if (!merged.has(sf)) merged.set(sf, new Map());
        const entry = merged.get(sf);
        if (entry) {
          for (const [num, count] of da) {
            entry.set(num, (entry.get(num) || 0) + count);
          }
        }
      }
    }
  }

  // Write merged output
  const outputRecords = [];
  for (const [sf, data] of merged) {
    const daLines = [];
    let hitLines = 0;

    // Sort line numbers numerically
    const sortedLineNums = [...data.keys()].sort((a, b) => Number(a) - Number(b));

    for (const num of sortedLineNums) {
      const count = data.get(num);
      if (count !== undefined) {
        daLines.push(`DA:${num},${count}`);
        if (count > 0) hitLines++;
      }
    }

    outputRecords.push([
      `TN:coverage-merged`,
      `SF:${sf}`,
      ...daLines,
      `LF:${data.size}`,
      `LH:${hitLines}`,
      `end_of_record`,
    ].join('\n'));
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, outputRecords.join('\n') + '\n', 'utf-8');
  return outputPath;
}
