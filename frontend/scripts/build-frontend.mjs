import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const distDir = path.join(frontendRoot, "dist");

/**
 * @param {string} target
 * @returns {Promise<void>}
 */
async function ensureCleanDir(target) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

/**
 * @param {string} source
 * @param {string} target
 * @returns {Promise<void>}
 */
async function copyFile(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
}

/**
 * @param {string} sourceDir
 * @param {string} targetDir
 * @param {(relativePath: string, entryType: "file" | "directory") => boolean} include
 * @param {string} [relativeBase=""]
 * @returns {Promise<void>}
 */
async function copyTree(sourceDir, targetDir, include, relativeBase = "") {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const relativePath = path.join(relativeBase, entry.name);

    if (entry.isDirectory()) {
      if (!include(relativePath, "directory")) {
        continue;
      }
      await copyTree(sourcePath, targetDir, include, relativePath);
      continue;
    }

    if (!include(relativePath, "file")) {
      continue;
    }

    const targetPath = path.join(targetDir, relativePath);
    await copyFile(sourcePath, targetPath);
  }
}

/**
 * @param {string} relativePath
 * @param {"file" | "directory"} entryType
 * @returns {boolean}
 */
function includeSrc(relativePath, entryType) {
  const normalized = relativePath.replaceAll(path.sep, "/");

  if (entryType === "directory") {
    return !normalized.startsWith("lib/components") && !normalized.startsWith("lib/stores");
  }

  if (normalized.endsWith(".js") || normalized.endsWith(".css") || normalized.endsWith(".woff2") || normalized.endsWith(".png") || normalized.endsWith(".txt")) {
    return true;
  }

  return false;
}

await ensureCleanDir(distDir);
await copyFile(path.join(frontendRoot, "index.html"), path.join(distDir, "index.html"));
await copyTree(path.join(frontendRoot, "src"), path.join(distDir, "src"), includeSrc);
await copyTree(path.join(frontendRoot, "wailsjs"), path.join(distDir, "wailsjs"), () => true);

const builtIndex = path.join(distDir, "index.html");
const builtIndexStats = await stat(builtIndex);
console.log(`Built frontend/dist (${builtIndexStats.size} bytes index.html)`);
