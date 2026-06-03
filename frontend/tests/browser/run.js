// @ts-check

/**
 * Browser test runner entry point.
 *
 * Loaded by index.html when window.location.hash === "#test".
 * Runs all browser/*.test.js files and renders results to the page.
 *
 * Usage:
 *   cd frontend && npm run dev
 *   Open http://localhost:5173/#test
 */

import { collectTests, runTests } from "../lib/test.js";

// Import all browser test files (side-effect only, registers tests)
// @ts-ignore
import "./naf-dom.test.js";

// Collect and run all registered tests
const allTests = collectTests();

if (allTests.length === 0) {
  console.log("No browser tests registered.");
  document.body.innerHTML = "<h1>No browser tests found</h1>";
} else {
  // Create test results container
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

  // Custom log function that writes to both console and page
  /** @type {string[]} */
  const logs = [];
  /** @param {string} msg */
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  // Run tests
  runTests(allTests, { log }).then((result) => {
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
  });
}
