import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lcovPath = resolve(root, "coverage/all.lcov");
const htmlDir = resolve(root, "coverage/html");

if (!existsSync(lcovPath)) {
  console.error("Missing coverage/all.lcov");
  console.error("Run `npm run test:coverage:all` first.");
  process.exit(1);
}

const genhtmlCheck = spawnSync("which", ["genhtml"], { encoding: "utf-8" });
if (genhtmlCheck.status !== 0) {
  console.error("genhtml is not installed.");
  console.error("Install the `lcov` package, then rerun `npm run test:coverage:html`.");
  console.error("  Fedora: sudo dnf install lcov");
  console.error("  Debian/Ubuntu: sudo apt install lcov");
  console.error("  macOS: brew install lcov");
  process.exit(1);
}

const result = spawnSync("genhtml", [lcovPath, "--output-directory", htmlDir], {
  cwd: root,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`HTML coverage report written to: ${htmlDir}`);
