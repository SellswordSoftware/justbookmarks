# Testing Plan

## Reader And Goal

This document is for an internal engineer extending the justbookmarks test infrastructure.

After reading it, the engineer should be able to:

1. understand which modules are covered and which remain
2. add new tests following the established patterns
3. implement Lane 2 (browser test harness) when needed

## Status

- **Lane 1 (Node tests)** -- DONE. 181 tests across 10 test files, 180 passing, 1 skipped.
- **Lane 2 (Browser tests)** -- IN PROGRESS. Harness built, 105 browser tests (78 naf-dom + 27 component). Runs in Vite dev server at `/#test`.

## Design Principles

- Zero npm dependencies for the test framework itself
- Test files live in `frontend/tests/` and are never imported by app code, so they are automatically excluded from production builds
- The framework provides `describe`, `test`, `test.skip`, `test.only`, and `assert` with `ok`, `equal`, `strictEqual`, `deepEqual`, `throws`, `notOk`
- Tests run in Node (Lane 1) or in the Wails webview (Lane 2) depending on the module under test
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
      run.js                # Browser test entry point
      naf-dom.test.js       # 78 DOM-specific NAF tests
      component.test.js     # 27 component rendering tests
    run.js             # Entry point: discovers and runs all .test.js files
```

## Running Tests

```bash
cd frontend
npm run test              # Run all Lane 1 (Node) tests
npm run test -- --grep "selection"  # Run tests matching pattern
```

Browser tests (Lane 2):

```bash
cd frontend && npm run dev
# Open http://localhost:5173/#test          # HTML results in browser
# Open http://localhost:5173/#test-json     # JSON output in page body
```

For script consumption, use a headless browser to fetch `/#test-json`
and read the page body text. The `#test-json` hash renders plain JSON
to `document.body.textContent` instead of HTML.

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

## Lane 2: Browser Test Harness (In Progress)

### Overview

A lightweight in-app test page that runs inside the Wails webview with a real DOM and real browser APIs. No Mocha dependency -- the same `test.js` and `assert.js` framework from Lane 1, adapted for browser execution.

### Planned File Structure

```
frontend/
  test-runner.html          # Test page served by Wails in test mode
  tests/
    browser/
      run.js                # Browser test entry point
      naf-dom.test.js       # DOM-specific NAF tests
      component.test.js     # Component rendering tests
```

### Serving The Test Page

**Approach B: URL Hash (Recommended)**

Keep `index.html` as the entry point. Add a small script that checks `window.location.hash`:

```html
<script>
  if (window.location.hash === "#test") {
    // Load test runner instead of app
    import('/tests/browser/run.js');
  } else {
    // Normal app startup
    import('/src/app/main.js');
  }
</script>
```

This approach requires no Go changes. Launch the app with the test hash to run browser tests. The downside is the test page shares the same HTML shell as the app.

### Browser Test Runner

`tests/browser/run.js`:

- Imports test.js/assert.js (same framework, browser-compatible)
- Imports all browser/*.test.js files
- Runs tests and renders results to a `<div id="test-results">`
- Also logs to console for programmatic consumption

### Planned Browser Test Coverage

#### `naf-dom.test.js`

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

#### `component.test.js`

Test component rendering:

- Components mount and render expected DOM structure
- Signal-driven updates reflect in DOM
- Data-ref elements are accessible via ctx.refs

### Running Browser Tests (When Implemented)

```bash
# Vite dev server (manual verification)
cd frontend && npm run dev
# Open http://localhost:5173/#test in a browser

# Wails dev (integration verification)
JUSTBOOKMARKS_TEST=1 wails dev
```

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
- **Lane 2** is in progress: harness built with URL hash approach, 105 browser tests (78 naf-dom + 27 component). Runs in Vite dev server at `/#test`
- The framework is ~250 lines total (`test.js` + `assert.js`)
- No production impact -- test files are never imported by app code
- Go backend already has adequate test coverage with stdlib `testing`
