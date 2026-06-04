# Coverage Reporter Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a home-grown code coverage reporter that generates lcov files consumable by VS Code extensions (Coverage Gutters) with zero npm dependencies.

**Architecture:** Line-level instrumentation via source transformation. A coverage engine detects executable lines in source files and injects counter calls. For Node tests, a custom ES module loader transforms source files on import. For browser tests, a Vite plugin transforms source files during dev. A shared lcov writer produces standard format output.

**Tech Stack:** Node.js built-in APIs only (fs, path, child_process). ES module loader (`--experimental-loader`). Vite plugin API. Lcov plain text format.

**Known Limitation:** Function-level coverage (all lines in a called function are marked covered). Dead code inside conditional branches is not detected. This is acceptable for the initial implementation — it identifies untested functions, which is the primary signal developers need.

---

## Phase 1: Core Coverage Engine

### Task 1: Create the instrumentation engine

**Objective:** Build `instrument(code, sourcePath)` that detects executable lines and returns instrumented source with coverage counter calls.

**Files:**
- Create: `frontend/tests/lib/coverage-instrument.js`

**Step 1: Create the file with the `findExecutableLines` function**

This function identifies which lines contain executable code by filtering out blanks, pure comments, and structural-only lines (closing braces, commas).

```javascript
// frontend/tests/lib/coverage-instrument.js

/**
 * Find line numbers (1-indexed) that contain executable JavaScript code.
 * Skips blank lines, pure comment lines, and lines that are only closing braces/commas.
 * @param {string} source
 * @returns {number[]}
 */
export function findExecutableLines(source) {
  const lines = source.split('\n');
  /** @type {number[]} */
  const executable = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle block comments
    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    // Skip blank lines
    if (!trimmed.length) continue;

    // Skip single-line comments
    if (trimmed.startsWith('//')) continue;

    // Skip JSDoc lines
    if (trimmed.startsWith('*') || trimmed.startsWith('/**') || trimmed.startsWith('*/')) {
      if (trimmed.startsWith('/*') && !trimmed.startsWith('/**')) {
        // Non-JSDoc block comment
        if (trimmed.includes('*/')) continue;
        inBlockComment = true;
        continue;
      }
      if (trimmed.startsWith('/**')) {
        if (!trimmed.includes('*/')) inBlockComment = true;
      }
      continue;
    }

    // Skip lines that are only closing braces, commas, or parens
    if (/^[\]\)}\],\s]*$/.test(trimmed)) continue;

    executable.push(i + 1); // 1-indexed
  }

  return executable;
}
```

**Step 2: Add the `instrument` function**

The instrument function takes source code and a path, finds executable lines, and injects a `__cov__(path, [lines])` call at the top of each function. This groups lines by their containing function scope so coverage is only recorded when the function actually executes.

```javascript
/**
 * @typedef {object} FunctionRange
 * @property {number} startLine  1-indexed line of function keyword/arrow
 * @property {number} endLine    1-indexed line of closing brace
 * @property {number[]} executableLines  executable lines within this function
 */

/**
 * Detect function boundaries using brace counting.
 * Handles: function declarations, function expressions, arrow functions with block bodies.
 * @param {string} source
 * @param {number[]} allExecutableLines
 * @returns {FunctionRange[]}
 */
function findFunctionRanges(source, allExecutableLines) {
  const lines = source.split('\n');
  /** @type {FunctionRange[]} */
  const ranges = [];
  /** @type {boolean[]} */
  const consumed = new Array(allExecutableLines.length).fill(false);

  // Patterns that indicate a function start
  const funcPatterns = [
    /^export\s+default\s+function\s+/,
    /^export\s+function\s+/,
    /^function\s+/,
    /=\s*async\s+function\s*\(/,
    /=\s*function\s*\(/,
    /=\s*async\s*\([^)]*\)\s*=>\s*\{/,
    /=\s*\([^)]*\)\s*=>\s*\{/,
    /=\s*\w+\s*=>\s*\{/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFuncStart = funcPatterns.some(p => p.test(line));

    if (!isFuncStart) continue;

    // Find the opening brace
    let braceLine = i;
    if (!line.includes('{')) {
      // Look for opening brace on next few lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('{')) {
          braceLine = j;
          break;
        }
      }
    }

    if (!lines[braceLine].includes('{')) continue;

    // Count braces to find function end
    let depth = 0;
    let started = false;
    let endLine = braceLine;

    for (let j = braceLine; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        if (ch === '}') depth--;
      }
      if (started && depth === 0) {
        endLine = j;
        break;
      }
    }

    // Collect executable lines within this function range
    /** @type {number[]} */
    const funcExecutable = [];
    for (const execLine of allExecutableLines) {
      const idx = allExecutableLines.indexOf(execLine);
      if (execLine >= (i + 1) && execLine <= (endLine + 1)) {
        funcExecutable.push(execLine);
        if (!consumed[idx]) consumed[idx] = true;
      }
    }

    if (funcExecutable.length > 0) {
      ranges.push({
        startLine: i + 1,
        endLine: endLine + 1,
        executableLines: funcExecutable,
      });
    }
  }

  // Remaining unconsumed lines belong to module-level code
  const moduleLevel = allExecutableLines.filter((_, idx) => !consumed[idx]);
  if (moduleLevel.length > 0) {
    ranges.push({
      startLine: 1,
      endLine: lines.length,
      executableLines: moduleLevel,
    });
  }

  return ranges;
}
```

**Step 3: Add the main `instrument` function that injects coverage calls**

```javascript
/**
 * Instrument source code with coverage tracking.
 * Injects __cov__(path, [lines]) calls at function entry points.
 * @param {string} source
 * @param {string} sourcePath  Relative path for coverage reporting
 * @returns {string} Instrumented source code
 */
export function instrument(source, sourcePath) {
  const allExecutable = findExecutableLines(source);
  if (allExecutable.length === 0) return source;

  const ranges = findFunctionRanges(source, allExecutable);
  const lines = source.split('\n');

  // Collect injections: { line: 0-indexed line to insert after, text: injection string }
  /** @type {{ line: number, text: string }[]} */
  const injections = [];

  for (const range of ranges) {
    // Insert coverage call right after the function's opening brace line
    const insertAfter = range.startLine - 1; // 0-indexed
    const lineArgs = range.executableLines.join(',');
    const call = `__cov__("${sourcePath}",[${lineArgs}]);`;
    injections.push({ line: insertAfter, text: call });
  }

  // Apply injections in reverse order to preserve line numbers
  injections.sort((a, b) => b.line - a.line);

  for (const inj of injections) {
    const indent = '  ';
    lines.splice(inj.line + 1, 0, `${indent}${inj.text}`);
  }

  // Prepend the __cov__ function definition
  const covDef = [
    'var __cov__ = function(p,l){(function(){var c=globalThis.__coverage__||(globalThis.__coverage__={});var f=c[p]||(c[p]={lines:{}});var ln=f.lines;l.forEach(function(n){ln[n]=(ln[n]||0)+1})})()};',
  ];

  return covDef.join('\n') + '\n' + lines.join('\n');
}
```

**Step 4: Verify the instrumentation output manually**

Run a quick test:

```bash
cd frontend
node -e "
import { instrument } from './tests/lib/coverage-instrument.js';
const code = 'export function add(a, b) {\n  return a + b;\n}';
console.log(instrument(code, 'test.js'));
"
```

Expected output should show `__cov__` injection after the opening brace of the function.

**Step 5: Commit**

```bash
git add frontend/tests/lib/coverage-instrument.js
git commit -m "feat(coverage): add instrumentation engine with function-level coverage"
```

---

### Task 2: Create the lcov writer

**Objective:** Build `writeLcov(coverage, basePath)` that converts the `__coverage__` data structure into standard lcov format.

**Files:**
- Create: `frontend/tests/lib/coverage-lcov.js`

**Step 1: Create the lcov writer**

The lcov format is plain text with one record per source file. Each record has TN (test name), SF (source file), DA (data: line,execution_count), FN/FDA (function data, optional), and end_of_record.

```javascript
// frontend/tests/lib/coverage-lcov.js

import { writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

/**
 * Convert __coverage__ data to lcov format text.
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

    // Count total lines and hit lines
    let hitLines = 0;
    let totalLines = 0;
    const daLines = [];

    for (const [lineNum, count] of Object.entries(lines)) {
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
 * @param {object} coverage  The globalThis.__coverage__ object
 * @param {string} outputPath  Path to write lcov file
 * @param {string} basePath  Filesystem base path for resolving source paths
 */
export function writeLcovFile(coverage, outputPath, basePath) {
  const lcovText = coverageToLcov(coverage, basePath);
  writeFileSync(outputPath, lcovText, 'utf-8');
  return outputPath;
}
```

**Step 2: Verify the lcov output format**

```bash
cd frontend
node -e "
import { coverageToLcov } from './tests/lib/coverage-lcov.js';
const fakeCoverage = {
  'src/features/tree/state/normalize.js': {
    lines: { '38': 5, '39': 5, '40': 1, '43': 4, '44': 4, '45': 4 }
  }
};
console.log(coverageToLcov(fakeCoverage, '/home/mike/sellsword/justbookmarks/frontend'));
"
```

Expected output should match standard lcov format with TN, SF, DA, LF, LH, end_of_record.

**Step 3: Commit**

```bash
git add frontend/tests/lib/coverage-lcov.js
git commit -m "feat(coverage): add lcov format writer"
```

---

## Phase 2: Node Test Integration

### Task 3: Create the Node ES module loader for coverage

**Objective:** Build a custom ES module loader that intercepts imports of source files and returns instrumented versions, enabling coverage tracking during Node tests.

**Files:**
- Create: `frontend/tests/lib/coverage-loader.js`

**Step 1: Create the loader**

The loader uses Node's `--experimental-loader` API. It transforms any `.js` file under `src/` by running it through the instrumentation engine. Test files and library files are passed through unmodified.

```javascript
// frontend/tests/lib/coverage-loader.js

import { instrument } from './coverage-instrument.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '../..');

/**
 * Custom ES module loader that instruments source files for coverage.
 * Usage: node --experimental-loader file://path/to/coverage-loader.js tests/run.js
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
  const relPath = resolve(filePath).replace(frontendRoot + '/', '');

  // Instrument the source
  const instrumented = instrument(source, relPath);

  return {
    format: 'module',
    source: instrumented,
  };
}
```

**Step 2: Commit**

```bash
git add frontend/tests/lib/coverage-loader.js
git commit -m "feat(coverage): add Node ES module loader for source instrumentation"
```

---

### Task 4: Integrate coverage into the Node test runner

**Objective:** Add `--coverage` flag to `tests/run.js` that enables the coverage loader, collects results after tests, and writes an lcov file.

**Files:**
- Modify: `frontend/tests/run.js`
- Modify: `frontend/package.json`

**Step 1: Add coverage support to the test runner**

Modify `frontend/tests/run.js` to:

1. Parse `--coverage` CLI flag
2. When `--coverage` is set, initialize `globalThis.__coverage__` and use the loader
3. After tests complete, write the lcov file

The modification is to the existing `run.js`. Add after the CLI args parsing (around line 31):

```javascript
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
```

Add after the test execution (around line 60), before the exit:

```javascript
const result = await runTests(allTests, { grep: grepPattern });

// Write coverage report if enabled
if (enableCoverage && globalThis.__coverage__) {
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
```

Add the `frontendRootPath` constant near the top:

```javascript
const frontendRootPath = resolve(__dirname, '..');
```

**Step 2: Add `test:coverage` script to package.json**

The script needs to pass `--experimental-loader` with the absolute path to the loader file. Add to the scripts section:

```json
"test:coverage": "node --experimental-loader file://$(pwd)/tests/lib/coverage-loader.js tests/run.js --coverage"
```

**Step 3: Run the coverage-enabled tests and verify**

```bash
cd frontend
npm run test:coverage
```

Expected: tests run normally, then an lcov file is written to `frontend/coverage.lcov` with a coverage percentage summary.

**Step 4: Verify the lcov file content**

```bash
head -30 frontend/coverage.lcov
```

Expected: standard lcov format with TN, SF, DA lines for instrumented source files.

**Step 5: Add `coverage.lcov` to `.gitignore`**

```bash
echo "coverage.lcov" >> .gitignore
```

**Step 6: Commit**

```bash
git add frontend/tests/run.js frontend/package.json frontend/.gitignore
git commit -m "feat(coverage): integrate coverage into Node test runner with --coverage flag"
```

---

## Phase 3: Browser Test Integration

### Task 5: Create the Vite coverage plugin

**Objective:** Build a Vite plugin that instruments source files during dev mode when coverage is enabled, and injects the `__cov__` function definition.

**Files:**
- Create: `frontend/tests/lib/coverage-vite-plugin.js`

**Step 1: Create the Vite plugin**

```javascript
// frontend/tests/lib/coverage-vite-plugin.js

import { instrument } from './coverage-instrument.js';
import { resolve } from 'node:path';

/**
 * Vite plugin that instruments source files for coverage tracking.
 * Only active when COVERAGE_ENABLED environment variable is set.
 * @returns {import('vite').Plugin}
 */
export function coveragePlugin() {
  const frontendRoot = process.cwd();

  return {
    name: 'coverage-instrument',

    config(userConfig) {
      // Inject __coverage__ global initialization
      return {
        define: {
          ...userConfig.define,
        },
      };
    },

    transform(code, id) {
      // Only instrument source files under src/
      if (!id.endsWith('.js') || !id.includes('/src/')) return null;

      // Get relative path for coverage reporting
      const relPath = id.replace(frontendRoot + '/', '');

      return instrument(code, relPath);
    },
  };
}
```

**Step 2: Commit**

```bash
git add frontend/tests/lib/coverage-vite-plugin.js
git commit -m "feat(coverage): add Vite plugin for browser source instrumentation"
```

---

### Task 6: Modify the browser test runner to collect and report coverage

**Objective:** Update the browser test infrastructure to enable the Vite coverage plugin, extract coverage data from the browser, and merge it into the lcov output.

**Files:**
- Modify: `frontend/tests/browser/run.js`
- Modify: `frontend/tests/browser/run-browser.js`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/package.json`

**Step 1: Modify `tests/browser/run.js` to include coverage in JSON output**

At the end of the test run (after `runTests` completes), extract `__coverage__` and include it in the JSON output:

Modify the JSON output section (around line 56):

```javascript
if (getMode() === "json") {
  const output = {
    passed: result.passed,
    failed: result.failed,
    skipped: result.skipped,
    results: result.results,
    coverage: globalThis.__coverage__ || null,
  };
  document.body.textContent = JSON.stringify(output, null, 2);
}
```

**Step 2: Modify `tests/browser/run-browser.js` to use the coverage Vite config**

Create a temporary Vite config that includes the coverage plugin. Modify `startVite()` to use a custom config file when coverage is enabled.

Add a `--coverage` flag parser at the top:

```javascript
const enableCoverage = process.argv.includes('--coverage');
```

Create a coverage-aware Vite config. Add a function:

```javascript
/**
 * Write a temporary Vite config that includes the coverage plugin.
 * @returns {string} Path to the temp config file
 */
function writeCoverageViteConfig() {
  const configPath = join(frontendRoot, 'vite.coverage.config.js');
  const configContent = `
import { defineConfig } from 'vite';
import { coveragePlugin } from './tests/lib/coverage-vite-plugin.js';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  build: { outDir: 'dist', emptyOutDir: true },
  define: { __TEST_MODE__: JSON.stringify(command === 'serve') },
  plugins: [coveragePlugin()],
}));
`;
  writeFileSync(configPath, configContent, 'utf-8');
  return configPath;
}}
```

Modify `startVite()` to use the coverage config:

```javascript
function startVite() {
  console.log(`Starting Vite dev server on port ${VITE_PORT}...`);

  const configArg = enableCoverage ? ['--config', 'vite.coverage.config.js'] : [];
  const vite = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host', '127.0.0.1', ...configArg], {
    cwd: frontendRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  // ... rest unchanged
}
```

Add cleanup of the temp config in the finally block:

```javascript
import { existsSync, rmSync } from 'fs';
// In finally:
const covConfig = join(frontendRoot, 'vite.coverage.config.js');
if (existsSync(covConfig)) rmSync(covConfig);
```

**Step 3: Modify `runTests()` in `run-browser.js` to extract and write coverage**

After parsing the dump-dom output, extract the coverage field and write an lcov file:

```javascript
function runTests(binary, viteInfo) {
  // ... existing code ...
  const result = parseDumpDomOutput(result.stdout);

  // Write coverage report if enabled and coverage data exists
  if (enableCoverage && result.coverage) {
    const { writeLcovFile } = await import(join(__dirname, 'lib/coverage-lcov.js'));
    const lcovPath = join(frontendRoot, 'coverage-browser.lcov');
    writeLcovFile(result.coverage, lcovPath, frontendRoot);
    console.log(`Browser coverage report written to: ${lcovPath}`);

    // Print summary
    let totalLines = 0;
    let hitLines = 0;
    for (const [path, data] of Object.entries(result.coverage)) {
      for (const [line, count] of Object.entries(data.lines)) {
        totalLines++;
        if (count > 0) hitLines++;
      }
    }
    const pct = totalLines > 0 ? ((hitLines / totalLines) * 100).toFixed(1) : '0.0';
    console.log(`Browser line coverage: ${hitLines}/${totalLines} (${pct}%)`);
  }

  return result;
}
```

**Step 4: Add `test:browser:coverage` script to package.json**

```json
"test:browser:coverage": "node tests/browser/run-browser.js --coverage"
```

**Step 5: Add `vite.coverage.config.js` and `coverage-browser.lcov` to `.gitignore`**

```bash
echo -e "vite.coverage.config.js\ncoverage-browser.lcov" >> .gitignore
```

**Step 6: Run browser tests with coverage and verify**

```bash
cd frontend
npm run test:browser:coverage
```

Expected: tests run normally, coverage data is extracted from the browser, and `frontend/coverage-browser.lcov` is written.

**Step 7: Commit**

```bash
git add frontend/tests/browser/run.js frontend/tests/browser/run-browser.js frontend/package.json frontend/.gitignore
git commit -m "feat(coverage): integrate coverage into browser test runner"
```

---

## Phase 4: Polish and Verification

### Task 7: Add combined coverage merging (optional enhancement)

**Objective:** Provide a single command that runs both Node and browser tests with coverage and merges the lcov files into one.

**Files:**
- Create: `frontend/tests/lib/coverage-merge.js`
- Modify: `frontend/package.json`

**Step 1: Create the lcov merger**

```javascript
// frontend/tests/lib/coverage-merge.js

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Merge multiple lcov files into one.
 * When the same source file appears in multiple inputs, execution counts are summed.
 * @param {string[]} inputPaths  Paths to lcov files to merge
 * @param {string} outputPath    Path to write merged lcov file
 */
export function mergeLcovFiles(inputPaths, outputPath) {
  /** @type {Map<string, { lines: Map<string, number> }> } */
  const merged = new Map();

  for (const inputPath of inputPaths) {
    const content = readFileSync(inputPath, 'utf-8');
    const records = content.split('end_of_record').filter(r => r.trim());

    for (const record of records) {
      const lines = record.split('\n');
      let sf = null;
      /** @type {Map<string, number>} */
      const da = new Map();

      for (const line of lines) {
        if (line.startsWith('SF:')) sf = line.slice(3);
        if (line.startsWith('DA:') && sf) {
          const [, num, count] = line.slice(3).split(',');
          da.set(num, (da.get(num) || 0) + parseInt(count, 10));
        }
      }

      if (sf) {
        if (!merged.has(sf)) merged.set(sf, { lines: new Map() });
        const entry = merged.get(sf);
        for (const [num, count] of da) {
          entry.lines.set(num, (entry.lines.get(num) || 0) + count);
        }
      }
    }
  }

  // Write merged output
  const outputRecords = [];
  for (const [sf, data] of merged) {
    const daLines = [];
    let hitLines = 0;
    for (const [num, count] of data.lines) {
      daLines.push(`DA:${num},${count}`);
      if (count > 0) hitLines++;
    }
    outputRecords.push([
      `TN:coverage-merged`,
      `SF:${sf}`,
      ...daLines,
      `LF:${data.lines.size}`,
      `LH:${hitLines}`,
      `end_of_record`,
    ].join('\n'));
  }

  writeFileSync(outputPath, outputRecords.join('\n') + '\n', 'utf-8');
  return outputPath;
}
```

**Step 2: Add `test:coverage:all` script**

This script runs both Node and browser coverage, then merges them:

```json
"test:coverage:all": "node tests/run.js --coverage && node tests/browser/run-browser.js --coverage && node -e \"import('./tests/lib/coverage-merge.js').then(m=>m.mergeLcovFiles(['coverage.lcov','coverage-browser.lcov'],'coverage-all.lcov'))\""
```

**Step 3: Add `coverage-all.lcov` to `.gitignore`**

**Step 4: Commit**

```bash
git add frontend/tests/lib/coverage-merge.js frontend/package.json frontend/.gitignore
git commit -m "feat(coverage): add lcov merging for combined Node + browser coverage"
```

---

## File Summary

### New Files (5)

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `frontend/tests/lib/coverage-instrument.js` | Source instrumentation engine | ~130 |
| `frontend/tests/lib/coverage-lcov.js` | Lcov format writer | ~50 |
| `frontend/tests/lib/coverage-loader.js` | Node ES module loader | ~30 |
| `frontend/tests/lib/coverage-vite-plugin.js` | Vite transform plugin | ~35 |
| `frontend/tests/lib/coverage-merge.js` | Lcov file merger | ~60 |

**Total new code: ~300 lines**

### Modified Files (4)

| File | Change |
|------|--------|
| `frontend/tests/run.js` | Add `--coverage` flag, lcov output |
| `frontend/tests/browser/run.js` | Include `__coverage__` in JSON output |
| `frontend/tests/browser/run-browser.js` | Add `--coverage` flag, Vite config switching, lcov output |
| `frontend/package.json` | Add `test:coverage`, `test:browser:coverage`, `test:coverage:all` scripts |

### Generated Files (gitignored)

| File | Generated by |
|------|-------------|
| `frontend/coverage.lcov` | `npm run test:coverage` |
| `frontend/coverage-browser.lcov` | `npm run test:browser:coverage` |
| `frontend/coverage-all.lcov` | `npm run test:coverage:all` |
| `frontend/vite.coverage.config.js` | `run-browser.js --coverage` (temp, cleaned up) |

## VS Code Integration

To view coverage in VS Code:

1. Install the "Coverage Gutters" extension (or similar)
2. Run `npm run test:coverage` or `npm run test:coverage:all`
3. Open the Coverage Gutters panel and point it at `frontend/coverage.lcov` or `frontend/coverage-all.lcov`

Alternatively, add to `.vscode/settings.json`:

```json
{
  "coverage-gutters.coverageFilePattern": "frontend/coverage*.lcov"
}
```

## Verification Commands

After implementation:

```bash
cd frontend

# Node coverage
npm run test:coverage
# Expected: tests pass, coverage.lcov written, percentage reported

# Browser coverage
npm run test:browser:coverage
# Expected: tests pass, coverage-browser.lcov written, percentage reported

# Combined coverage
npm run test:coverage:all
# Expected: both test suites pass, coverage-all.lcov written

# Verify lcov format
head -20 coverage.lcov
# Expected: TN:, SF:, DA: lines in standard lcov format

# Verify normal tests still work
npm run test
npm run test:browser
# Expected: identical behavior to before coverage was added

# Verify production build unaffected
npm run typecheck
npm run build
# Expected: passes as before
```

## Decision Summary

- **Zero npm dependencies** -- all instrumentation, loading, and reporting via Node.js built-in APIs
- **Function-level coverage** -- tracks which functions are called; all lines in a called function are marked covered
- **Standard lcov format** -- compatible with VS Code Coverage Gutters, codecov, and other lcov consumers
- **No production impact** -- coverage code lives in `tests/`, never imported by app code
- **Separate Node and browser reports** -- can be merged for a unified view
- **Known gap** -- dead code inside conditional branches is not detected (would require AST-level instrumentation)
