// @ts-check

/**
 * Vite plugin for coverage instrumentation.
 *
 * Instruments source files during dev mode so that the __cov__ function
 * is called when code executes in the browser. Coverage data is collected
 * in globalThis.__coverage__ and extracted after tests complete.
 *
 * Only active when the plugin is included in the Vite config.
 */

import { instrument } from './coverage-instrument.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '../..');

/**
 * Vite plugin that instruments source files for coverage tracking.
 *
 * @returns {import('vite').Plugin}
 */
export function coveragePlugin() {
  return {
    name: 'coverage-instrument',

    /**
     * Transform source files under src/ with coverage instrumentation.
     *
     * @param {string} code
     * @param {string} id  Module ID (file path)
     * @returns {string | null}
     */
    transform(code, id) {
      // Only instrument source files under src/
      if (!id.endsWith('.js') || !id.includes('/src/')) return null;

      // Get relative path for coverage reporting
      const relPath = id.replace(frontendRoot + '/', '');

      return instrument(code, relPath);
    },
  };
}
