#!/usr/bin/env node

/**
 * Generate a large Netscape bookmark HTML file for performance testing.
 *
 * Structure per iteration:
 *   folder1-N
 *     google.com
 *     facebook.com
 *     youtube.com
 *     github.com
 *     bing.com
 *     folder2-N
 *       google.com
 *       facebook.com
 *       youtube.com
 *       github.com
 *       bing.com
 *
 * 10 bookmarks per iteration x 100,000 iterations = 1,000,000 bookmarks.
 *
 * Usage:
 *   node frontend/scripts/generate-test-bookmarks.js [output_path] [iterations]
 *
 * Defaults:
 *   output_path  = frontend/test-data/bookmarks-1m.html
 *   iterations   = 100000
 */

const fs = require("fs");
const path = require("path");

const OUTPUT = process.argv[2] || path.join(__dirname, "..", "test-data", "bookmarks-1m.html");
const ITERATIONS = parseInt(process.argv[3], 10) || 100000;

const BOOKMARKS = [
  { title: "Google", url: "https://www.google.com" },
  { title: "Facebook", url: "https://www.facebook.com" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "GitHub", url: "https://github.com" },
  { title: "Bing", url: "https://www.bing.com" },
];

/**
 * Escape HTML entities for bookmark titles/URLs.
 */
function htmlEscape(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Generate a single bookmark line.
 */
function bookmarkLine(title, url) {
  return `<DT><A HREF="${htmlEscape(url)}" ADD_DATE="1700000000">${htmlEscape(title)}</A>\n`;
}

/**
 * Generate the content for one iteration: folder1-N containing 5 bookmarks + nested folder2-N with 5 bookmarks.
 */
function iterationContent(i) {
  let lines = "";
  // folder1-N
  lines += `<DT><H3>folder1-${i}</H3>\n`;
  lines += `<DL><p>\n`;
  for (const bm of BOOKMARKS) {
    lines += bookmarkLine(bm.title, bm.url);
  }
  // folder2-N (nested inside folder1-N)
  lines += `<DT><H3>folder2-${i}</H3>\n`;
  lines += `<DL><p>\n`;
  for (const bm of BOOKMARKS) {
    lines += bookmarkLine(bm.title, bm.url);
  }
  lines += `</DL><p>\n`; // close folder2-N
  lines += `</DL><p>\n`; // close folder1-N
  return lines;
}

// Ensure output directory exists
const dir = path.dirname(OUTPUT);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log(`Generating ${ITERATIONS} iterations (${ITERATIONS * 10} bookmarks) to ${OUTPUT}`);

const stream = fs.createWriteStream(OUTPUT, { encoding: "utf8" });

// Write header
stream.write(`<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`);

// Write all iterations
const total = ITERATIONS;
let written = 0;
const batchSize = 1000; // write in batches for progress reporting

for (let i = 1; i <= total; i++) {
  stream.write(iterationContent(i));
  written++;

  if (written % batchSize === 0) {
    const pct = ((written / total) * 100).toFixed(1);
    process.stdout.write(`\r  ${pct}% (${written}/${total} iterations)`);
  }
}

// Write footer
stream.write(`</DL><p>
`);

stream.end(() => {
  process.stdout.write("\n");
  const stats = fs.statSync(OUTPUT);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`Done! ${sizeMB} MB, ${total * 10} bookmarks in ${total} folder pairs.`);
});
