// @ts-check

/**
 * Browser test runner entry point.
 *
 * Loaded by index.html when URL has ?test=json or ?test=html.
 * Runs all browser/*.test.js files and renders results to the page.
 *
 * Usage:
 *   npm run test:prepare:dev
 *   npm run test:browser
 *   Open http://127.0.0.1:4173/?test=html       # HTML results in browser
 *   Open http://127.0.0.1:4173/?test=json       # JSON output for --dump-dom (CLI)
 */

import { collectTests, runTests } from "../lib/test.js";

/** @type {any} */ (window).__TAURI__ = {
  core: {
    async invoke() {
      throw new Error("window.__TAURI__.core.invoke is not available in browser tests");
    },
  },
  dpi: {
    LogicalSize: class {
      /** @param {number} width @param {number} height */
      constructor(width, height) {
        this.width = width;
        this.height = height;
      }
    },
  },
  window: {},
  webviewWindow: {},
};

/**
 * Determine output mode from URL query parameter.
 * @returns {"html" | "json"}
 */
function getMode() {
  const url = new URL(window.location.href);
  return url.searchParams.get("test") === "json" ? "json" : "html";
}

/** @returns {void} */
function applyHtmlReportPageStyles() {
  document.documentElement.style.height = "auto";
  document.documentElement.style.overflow = "auto";
  document.body.style.height = "auto";
  document.body.style.minHeight = "100vh";
  document.body.style.overflow = "auto";

  const appShell = document.getElementById("app");
  if (appShell instanceof HTMLElement) {
    appShell.style.display = "none";
  }
}

/**
 * @param {unknown} error
 * @returns {{ message: string, stack: string | null }}
 */
function serializeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack || null,
    };
  }

  return {
    message: String(error),
    stack: null,
  };
}

/**
 * @param {string} phase
 * @param {unknown} error
 */
function renderFailure(phase, error) {
  const payload = {
    passed: 0,
    failed: 1,
    skipped: 0,
    results: [],
    startupError: {
      phase,
      ...serializeError(error),
    },
  };

  if (getMode() === "json") {
    document.body.textContent = JSON.stringify(payload, null, 2);
    return;
  }

  applyHtmlReportPageStyles();
  document.body.innerHTML = "";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(payload, null, 2);
  document.body.appendChild(pre);
}

/** @type {boolean} */
let hasRenderedTerminalState = false;

window.addEventListener("error", (event) => {
  if (hasRenderedTerminalState) {
    return;
  }

  hasRenderedTerminalState = true;
  renderFailure("window.error", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  if (hasRenderedTerminalState) {
    return;
  }

  hasRenderedTerminalState = true;
  renderFailure("window.unhandledrejection", event.reason);
});

try {
  await Promise.all([
    import("./naf-dom.test.js"),
    import("./component.test.js"),
    import("./ui-state-dom.test.js"),
    import("./confirm-modal.test.js"),
    import("./toast-container.test.js"),
  ]);

  // Collect and run all registered tests
  const allTests = collectTests();

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
    hasRenderedTerminalState = true;

    if (getMode() === "json") {
      // Output plain JSON to the page body for --dump-dom consumption
      const output = {
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        results: result.results,
        coverage: /** @type {any} */ (globalThis).__coverage__ || null,
      };
      document.body.textContent = JSON.stringify(output, null, 2);
    } else {
      applyHtmlReportPageStyles();

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
} catch (error) {
  hasRenderedTerminalState = true;
  renderFailure("module-evaluation", error);
}
