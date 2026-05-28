import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = 34115;

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

/**
 * @param {string} requestPath
 * @returns {string}
 */
function resolveSafePath(requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const candidate = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.resolve(frontendRoot, `.${candidate}`);
  if (!resolved.startsWith(frontendRoot)) {
    throw new Error("Path escapes frontend root");
  }
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const filePath = resolveSafePath(req.url ?? "/");
    await access(filePath);
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const contentType = contentTypes.get(path.extname(filePath)) ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Frontend dev server running at http://${host}:${port}`);
});
