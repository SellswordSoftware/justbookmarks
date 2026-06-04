// @ts-check

/**
 * Coverage instrumentation engine.
 *
 * Detects executable lines in JavaScript source, groups them by function
 * scope, and injects __cov__(path, [lines]) calls at function entry points.
 *
 * Function-level coverage: all lines in a called function are marked covered
 * together. Dead code inside conditional branches is not detected.
 */

/**
 * Find line numbers (1-indexed) that contain executable JavaScript code.
 * Skips blank lines, pure comment lines, and lines that are only closing
 * braces, brackets, or commas.
 *
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

    // Handle JSDoc and block comments
    if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
      if (trimmed.includes('*/')) continue;
      inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('*/')) continue;

    // Skip lines that are only closing braces, brackets, parens, or commas
    if (/^[\]\)}\],\s]*$/.test(trimmed)) continue;

    executable.push(i + 1); // 1-indexed
  }

  return executable;
}

/**
 * @typedef {object} FunctionRange
 * @property {number} startLine  1-indexed line of function keyword/arrow
 * @property {number} endLine    1-indexed line of closing brace
 * @property {number[]} executableLines  executable lines within this function
 */

/**
 * Detect function boundaries using brace counting.
 *
 * Handles:
 * - function declarations (function foo() { ... })
 * - export function declarations
 * - arrow functions with block bodies (x => { ... })
 * - async functions
 *
 * Lines not consumed by any function range are grouped into a "module-level"
 * range so that top-level code (imports, exports, module-level expressions)
 * is also tracked.
 *
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
    /^export\s+async\s+function\s+/,
    /^export\s+function\s+/,
    /^async\s+function\s+/,
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

/**
 * Instrument source code with coverage tracking.
 *
 * Injects __cov__(path, [lines]) calls at function entry points so that
 * coverage is only recorded when the function actually executes.
 *
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
