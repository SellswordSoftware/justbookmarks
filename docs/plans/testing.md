# Testing Plan

## Reader And Goal

This document is for an internal engineer extending the justbookmarks test infrastructure.

After reading it, the engineer should be able to:

1. understand which modules are covered and which remain
2. add new tests following the established patterns
3. implement Lane 2 (browser test harness) when needed

## Status

- **Lane 1 (Node tests)** -- DONE. 181 tests across 10 test files, 180 passing, 1 skipped.
- **Lane 2 (Browser tests)** -- DONE. 105 browser tests (78 naf-dom + 27 component). Runs via `chrome-headless-shell --dump-dom` with auto-bootstrap.

## Design Principles

- Zero npm dependencies for the test framework itself
- Test files live in `frontend/tests/` and are never imported by app code, so they are automatically excluded from production builds
- The framework provides `describe`, `test`, `test.skip`, `test.only`, and `assert` with `ok`, `equal`, `strictEqual`, `deepEqual`, `throws`, `notOk`
- Tests run in Node (Lane 1) or in chrome-headless-shell (Lane 2) depending on the module under test
- No coverage reports, no parallelism, no snapshot testing -- keep it minimal

## Current File Structure

```
frontend/
  tests/
    lib/
      test.js          # describe/test/skip/only + runner (250 lines)
      assert.js        # ok/equal/strictEqual/deepEqual/throws/notOk
    fixtures/
      tree-data.js     # Reusable tree/node/selection state builders
    infra/
      errors.test.js   # 9 tests
      persistence.test.js  # 15 tests
    runtime/
      naf.test.js      # 34 tests (1 skipped)
    tree/
      normalize.test.js       # 14 tests
      normalize-flat.test.js  # 12 tests
      structure.test.js       # 24 tests
      expansion.test.js       # 14 tests
      selection.test.js       # 29 tests
      persistence.test.js     # 14 tests
    worker/
      tree-worker.test.js     # 14 tests
    browser/
      run-browser.js      # CLI runner: bootstraps chrome, starts Vite, runs --dump-dom
      run.js              # Browser test entry point (loaded by index.html)
      naf-dom.test.js     # 78 DOM-specific NAF tests
      component.test.js   # 27 component rendering tests
    run.js               # Entry point: discovers and runs all .test.js files
```

## Running Tests

```bash
cd frontend
npm run test              # Run all Lane 1 (Node) tests
npm run test -- --grep "selection"  # Run tests matching pattern
npm run test:browser      # Run all Lane 2 (Browser) tests via chrome-headless-shell
```

The `test:browser` script (`tests/browser/run-browser.js`) handles everything
automatically:

1. Detects platform (linux64, mac-arm64, mac-x64)
2. Fetches the latest Stable chrome-headless-shell from Chrome for Testing API
3. Downloads and extracts to `chrome-headless-shell/` at repo root (gitignored)
4. Starts Vite dev server on port 5173
5. Runs `chrome-headless-shell --dump-dom` against `/?test=json`
6. Parses JSON results from the dumped DOM
7. Reports results and exits with appropriate code

For manual verification, you can also open the test page in a browser:

```bash
cd frontend && npm run dev
# Open http://localhost:5173/#test              # HTML results (manual viewing)
# Open http://localhost:5173/?test=html         # HTML results (manual viewing)
# Open http://localhost:5173/?test=json         # JSON output (for --dump-dom)
```

Production verification still works:

```bash
npm run typecheck    # Must pass
npm run build        # Must succeed (tests are not bundled)
```

## Module Classification

### Pure Logic (Node testable) -- DONE

These modules are fully tested:

| Module | Test File | Test Count |
|--------|-----------|------------|
| `normalize.js` | `tree/normalize.test.js` | 14 |
| `normalize-flat.js` | `tree/normalize-flat.test.js` | 12 |
| `structure.js` | `tree/structure.test.js` | 24 |
| `expansion.js` | `tree/expansion.test.js` | 14 |
| `selection.js` | `tree/selection.test.js` | 29 |
| `persistence.js` (tree) | `tree/persistence.test.js` | 14 |
| `errors.js` | `infra/errors.test.js` | 9 |
| `naf.js` (reactive) | `runtime/naf.test.js` | 34 |
| `tree-worker.js` logic | `worker/tree-worker.test.js` | 14 |

### Needs Minimal Stubbing -- DONE

| Module | Test File | Test Count | Stub |
|--------|-----------|------------|------|
| `persistence.js` (infra) | `infra/persistence.test.js` | 15 | `window.localStorage` |

Tests use `beforeEach`/`afterEach` to set up and tear down a fake `Storage` object on `window.localStorage`. Lazy imports ensure the module loads fresh for each test suite.

### Needs Browser Context (DOM required) -- PARTIALLY TESTED

These modules can only be tested in Lane 2:

| Module | Path | Reason |
|--------|------|--------|
| `naf.js` (DOM) | `shared/runtime/naf.js` | template/mount/list/fx/attr/setText | **78 tests in `browser/naf-dom.test.js`** |
| `app-state.js` | `shared/state/app-state.js` | imports from `api.js`, Wails runtime |
| `tree-state.js` | `features/tree/state/tree-state.js` | imports from `api.js`, signals |
| `selection-state.js` | `features/tree/state/selection-state.js` | depends on tree-state signals |
| `expansion-state.js` | `features/tree/state/expansion-state.js` | depends on tree-state signals |
| `tree-mutations.js` | `features/tree/state/tree-mutations.js` | imports from `api.js`, signals |
| `load-workflow.js` | `features/tree/state/load-workflow.js` | imports from `api.js`, signals |
| All view modules | `features/*/view/*.js` | DOM rendering |
| All components | `components/*.js` | DOM rendering |
| All pages | `pages/*.js` | DOM rendering |

## Lane 2: Browser Test Harness (Done)

### Overview

A pure Node.js script (`tests/browser/run-browser.js`) that bootstraps
chrome-headless-shell, starts Vite dev server, runs browser tests via
`--dump-dom`, and reports results. Zero npm dependencies -- uses only
Node.js built-in APIs (`fetch`, `child_process`, `fs`, `zlib`, `os`).

### How It Works

1. **Platform detection** -- Detects OS/arch and maps to Chrome for Testing
   platform strings (linux64, mac-arm64, mac-x64, win64).

2. **Chrome bootstrap** -- Fetches the Chrome for Testing JSON API for the
   latest Stable version. Downloads and extracts chrome-headless-shell to
   `chrome-headless-shell/` at repo root (already in `.gitignore`).
   Subsequent runs reuse the installed version.

3. **Vite dev server** -- Spawns `npx vite --port 5173 --host 127.0.0.1`
   and polls until the server responds.

4. **Test execution** -- Runs `chrome-headless-shell --dump-dom` against
   `/?test=json`. The `index.html` script detects the `?test=json` query
   parameter and loads the test runner instead of the app. Top-level `await`
   in the test runner blocks the `load` event until all tests complete,
   ensuring `--dump-dom` captures the final DOM state with JSON results.

5. **Result parsing** -- Extracts JSON from the `<body>` content of the
   dumped DOM and reports pass/fail counts with individual failure details.

### File Structure

```
frontend/
  tests/
    browser/
      run-browser.js      # CLI runner (Node.js, zero deps)
      run.js              # Browser entry point (loaded by index.html)
      naf-dom.test.js     # 78 DOM-specific NAF tests
      component.test.js   # 27 component rendering tests
chrome-headless-shell/    # Auto-downloaded, gitignored
```

### Serving The Test Page

**Approach: Query Parameter**

Keep `index.html` as the entry point. A script checks `?test` query
parameter:

```html
<script type="module">
    const url = new URL(window.location.href);
    const testMode = url.searchParams.get("test");
    if (testMode === "json" || testMode === "html") {
        await import("./tests/browser/run.js");
    } else {
        import("./src/main.js");
    }
</script>
```

Query parameters are used instead of URL hashes because they are more
reliable with headless browser `--dump-dom` output. The `await import()`
blocks the `load` event until tests complete, which is required for
`--dump-dom` to capture the final DOM state.

### Browser Test Runner

`tests/browser/run.js`:

- Imports test.js/assert.js (same framework, browser-compatible)
- Imports all browser/*.test.js files
- Runs tests with top-level `await` (blocks load event)
- In `?test=json` mode: writes JSON to `document.body.textContent`
- In `?test=html` mode: renders HTML results page

### Browser Test Coverage

#### `naf-dom.test.js` (78 tests)

Test DOM-specific NAF functions:

- `template()` -- creates component with correct HTML structure
- `template()` -- extracts refs from data-ref attributes
- `mount()` -- appends component to host element
- `mount()` -- calls onMount callback with context
- `list()` -- renders correct number of rows from items
- `list()` -- calls setup callback for each row
- `fx()` -- sets up effect that updates on signal change
- `attr()` -- sets attribute on element
- `setText()` -- sets textContent on element
- `show()`/`hide()` -- toggles element visibility
- `requireRef()` -- returns ref by name, throws if missing

#### `component.test.js` (27 tests)

Test component rendering:

- Components mount and render expected DOM structure
- Signal-driven updates reflect in DOM
- Data-ref elements are accessible via ctx.refs
- Component lifecycle (mount/unmount)
- Component nesting and slot resolution
- Component cleanup

## Go Backend Tests

Already covered with stdlib `testing`:

```bash
go test ./internal/...
```

## Adding New Tests

1. Create a `.test.js` file in the appropriate subdirectory under `tests/`
2. Import `describe`, `test` from `../lib/test.js` (adjust path as needed)
3. Import assertions from `../lib/assert.js`
4. Import fixtures from `../fixtures/tree-data.js` if needed
5. Run `npm run test` -- the runner auto-discovers new test files

## What Not To Do

- Do not add npm dependencies for testing (no Vitest, no Jest, no Mocha, no JSDOM)
- Do not test modules that require Wails bindings unless running in Lane 2
- Do not write tests that depend on global state from `tree-state.js` signals -- test the pure functions in `selection.js`, `expansion.js`, `structure.js` instead
- Do not bundle test files into the Vite production build -- they live outside `src/` and are never imported by app code
- Do not test CSS styling or visual layout -- that is manual verification only

## Decision Summary

- **Lane 1** is complete: 181 tests covering all pure-logic modules with zero dependencies and instant execution
- **Lane 2** is complete: 105 browser tests (78 naf-dom + 27 component). Runs via `npm run test:browser` which auto-bootstraps chrome-headless-shell, starts Vite, and runs `--dump-dom`
- The framework is ~250 lines total (`test.js` + `assert.js`)
- No production impact -- test files are never imported by app code
- No npm dependencies for testing (no Playwright, no Vitest, no Jest)
- Go backend already has adequate test coverage with stdlib `testing`
