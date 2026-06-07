// @ts-check

/**
 * Custom ES module loader for coverage instrumentation.
 *
 * Intercepts imports of source files under src/ and returns instrumented
 * versions. Test files and library files are passed through unmodified.
 *
 * Usage:
 *   node --experimental-loader file://path/to/coverage-loader.js tests/run.js
 */

import { instrument } from './coverage-instrument.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '../..');

/**
 * Custom ES module load hook.
 *
 * @param {string} url  Module URL (file://...)
 * @param {{ format: string | null, importAssertions: object, shortBasename: string }} context
 * @param {(url: string, context: object) => Promise<object>} nextLoad  Delegate to default loader
 * @returns {Promise<object>} Module load result
 */
export async function load(url, context, nextLoad) {
  // Only transform .js files under src/
  if (!url.endsWith('.js') || !url.includes('/src/')) {
    return nextLoad(url, context);
  }

  // Read the original source
  const filePath = url.replace('file://', '');
  const source = readFileSync(filePath, 'utf-8');

  // Get relative path from frontend root for coverage reporting
  const relPath = filePath.replace(frontendRoot + '/', '');

  // Instrument the source
  const instrumented = instrument(source, relPath);

  return {
    format: 'module',
    source: instrumented,
    shortCircuit: true,
  };
}
