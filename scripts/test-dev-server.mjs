import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { instrument } from "../tests/lib/coverage-instrument.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = resolve(root, "src");
const testsRoot = resolve(root, "tests");
const host = "127.0.0.1";
const args = process.argv.slice(2);
const portFlagIndex = args.indexOf("--port");
const coverageEnabled = args.includes("--coverage");
const port = portFlagIndex >= 0 && args[portFlagIndex + 1]
  ? Number(args[portFlagIndex + 1])
  : 4173;

/** @type {Record<string, string>} */
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {string | Buffer} body
 * @param {string} [type]
 * @returns {void}
 */
function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

/**
 * @param {string} filePath
 * @param {Buffer} body
 * @returns {Buffer | string}
 */
function maybeInstrumentJavaScript(filePath, body) {
  if (!coverageEnabled) {
    return body;
  }

  if (!filePath.startsWith(srcRoot) || extname(filePath).toLowerCase() !== ".js") {
    return body;
  }

  const relativePath = filePath.replace(`${root}/`, "");
  return instrument(body.toString("utf-8"), relativePath);
}

/**
 * @param {string} urlPath
 * @returns {string}
 */
function resolveRequestPath(urlPath) {
  const cleanPath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  if (cleanPath === "/" || cleanPath === ".") {
    return resolve(srcRoot, "index.html");
  }

  if (cleanPath.startsWith("/tests/")) {
    return resolve(root, `.${cleanPath}`);
  }

  if (cleanPath.startsWith("/src/")) {
    return resolve(root, `.${cleanPath}`);
  }

  return resolve(srcRoot, `.${cleanPath}`);
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${host}:${port}`);
  const filePath = resolveRequestPath(requestUrl.pathname);
  const inSrc = filePath.startsWith(srcRoot);
  const inTests = filePath.startsWith(testsRoot);

  if (!inSrc && !inTests) {
    send(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, "Not found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const body = readFileSync(filePath);
  const maybeInstrumentedBody = maybeInstrumentJavaScript(filePath, body);
  send(res, 200, maybeInstrumentedBody, MIME_TYPES[ext] ?? "application/octet-stream");
});

server.listen(port, host, () => {
  const coverageSuffix = coverageEnabled ? " (coverage enabled)" : "";
  console.log(`Static test server ready at http://${host}:${port}${coverageSuffix}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
