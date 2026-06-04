// @ts-check

/**
 * Browser test runner entry point.
 *
 * Loaded by index.html when URL has ?test=json or ?test=html.
 * Runs all browser/*.test.js files and renders results to the page.
 *
 * Usage:
 *   cd frontend && npm run dev
 *   Open http://localhost:5173/?test=html       # HTML results in browser
 *   Open http://localhost:5173/?test=json       # JSON output for --dump-dom (CLI)
 */

import { collectTests, runTests } from "../lib/test.js";

// Stub window.go so that api.js and tree-state.js can load in the browser test environment.
// The api.js module uses optional chaining (window.go?.main?.App), so a null stub is sufficient.
// @ts-ignore
window.go = { main: { App: null }, wailsapi: { Handler: null } };

// Import all browser test files (side-effect only, registers tests)
// @ts-ignore
import "./naf-dom.test.js";
// @ts-ignore
import "./component.test.js";
// @ts-ignore
import "./ui-state-dom.test.js";
// @ts-ignore
import "./confirm-modal.test.js";
// @ts-ignore
import "./toast-container.test.js";

// Collect and run all registered tests
const allTests = collectTests();

/**
 * Determine output mode from URL query parameter.
 * @returns {"html" | "json"}
 */
function getMode() {
    const url = new URL(window.location.href);
    return url.searchParams.get("test") === "json" ? "json" : "html";
}

if (allTests.length === 0) {
  console.log("No browser tests registered.");
  if (getMode() === "json") {
    document.body.textContent = JSON.stringify({ passed: 0, failed: 0, skipped: 0, results: [] });
  } else {
    document.body.innerHTML = "<h1>No browser tests found</h1>";
  }
} else {
  // Custom log function that writes to both console and memory
  /** @type {string[]} */
  const logs = [];
  /** @param {string} msg */
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  // Run tests (await blocks the module, which blocks the load event,
  // which is required for --dump-dom to capture the final DOM state)
  const result = await runTests(allTests, { log });

  if (getMode() === "json") {
    // Output plain JSON to the page body for --dump-dom consumption
    const output = {
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      results: result.results,
      coverage: globalThis.__coverage__ || null,
    };
    document.body.textContent = JSON.stringify(output, null, 2);
  } else {
    // HTML output for browser viewing
    const container = document.createElement("div");
    container.id = "test-results";
    container.style.cssText = "font-family: monospace; padding: 20px; max-width: 900px; margin: 0 auto;";

    const header = document.createElement("h1");
    header.textContent = `Browser Tests (${allTests.length})`;
    container.appendChild(header);

    const resultsDiv = document.createElement("div");
    resultsDiv.id = "test-output";
    container.appendChild(resultsDiv);

    // Clear the page and mount test results
    document.body.innerHTML = "";
    document.body.appendChild(container);

    // Render all logs to the page
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = logs.join("\n");
    resultsDiv.appendChild(pre);

    // Render summary badge
    const summary = document.createElement("div");
    summary.style.cssText = "margin-top: 16px; padding: 12px; border-radius: 4px; font-weight: bold;";

    if (result.failed > 0) {
      summary.style.backgroundColor = "#ff4444";
      summary.style.color = "#fff";
    } else {
      summary.style.backgroundColor = "#44aa44";
      summary.style.color = "#fff";
    }

    summary.textContent = `${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`;
    resultsDiv.appendChild(summary);
  }
}
