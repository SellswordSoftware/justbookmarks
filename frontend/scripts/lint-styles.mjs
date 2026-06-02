import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const TOKENS_FILE = path.join(SRC_DIR, "styles", "tokens.css");
const THEMES_DIR = path.join(SRC_DIR, "styles", "themes");

const RAW_COLOR_PATTERN =
  /#(?:[0-9a-f]{3,8})\b|\brgba?\(|\bhsla?\(|\boklch\(|\blch\(|\blab\(/i;
const COLOR_PROPERTY_PATTERN =
  /^\s*(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|outline-color|fill|stroke|box-shadow)\s*:/i;
const CUSTOM_PROPERTY_PATTERN = /^--([_a-z0-9-]+)\s*:/i;
const ALLOWED_CUSTOM_PROPERTY_NAME = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function collectCssFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectCssFiles(fullPath);
      }

      return entry.isFile() && entry.name.endsWith(".css") ? [fullPath] : [];
    }),
  );

  return files.flat();
}

function stripBlockComments(line, state) {
  let result = "";
  let index = 0;

  while (index < line.length) {
    if (state.inBlockComment) {
      const commentEnd = line.indexOf("*/", index);
      if (commentEnd === -1) {
        return { text: result, inBlockComment: true };
      }

      index = commentEnd + 2;
      state.inBlockComment = false;
      continue;
    }

    const commentStart = line.indexOf("/*", index);
    if (commentStart === -1) {
      result += line.slice(index);
      break;
    }

    result += line.slice(index, commentStart);
    index = commentStart + 2;
    state.inBlockComment = true;
  }

  return { text: result, inBlockComment: state.inBlockComment };
}

function isThemeFile(filePath) {
  return filePath.startsWith(THEMES_DIR + path.sep);
}

function isTokensOrThemeFile(filePath) {
  return filePath === TOKENS_FILE || isThemeFile(filePath);
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

function reportError(errors, filePath, lineNumber, message) {
  errors.push(`${relative(filePath)}:${lineNumber}: ${message}`);
}

async function lintFile(filePath, errors) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const state = { inBlockComment: false };
  const allowThemeSelectors = isThemeFile(filePath);
  const allowRawColors = isTokensOrThemeFile(filePath);

  lines.forEach((originalLine, index) => {
    const lineNumber = index + 1;
    const { text } = stripBlockComments(originalLine, state);
    const line = text.trim();

    if (!line) {
      return;
    }

    if (!allowThemeSelectors && line.includes("[data-theme=")) {
      reportError(
        errors,
        filePath,
        lineNumber,
        'theme selectors are only allowed in "src/styles/themes/"',
      );
    }

    const customPropertyMatch = text.match(CUSTOM_PROPERTY_PATTERN);
    if (customPropertyMatch) {
      const propertyName = customPropertyMatch[1];
      if (!ALLOWED_CUSTOM_PROPERTY_NAME.test(propertyName)) {
        reportError(
          errors,
          filePath,
          lineNumber,
          `custom property "${propertyName}" does not match the allowed naming pattern`,
        );
      }
    }

    if (!allowRawColors && COLOR_PROPERTY_PATTERN.test(line) && RAW_COLOR_PATTERN.test(line)) {
      reportError(
        errors,
        filePath,
        lineNumber,
        "raw color values are only allowed in tokens.css and theme files",
      );
    }
  });
}

async function main() {
  const errors = [];
  const cssFiles = await collectCssFiles(SRC_DIR);

  await Promise.all(cssFiles.map((filePath) => lintFile(filePath, errors)));

  if (errors.length > 0) {
    console.error("Style guardrails failed:\n");
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }

  console.log(`Style guardrails passed for ${cssFiles.length} CSS files.`);
}

await main();
