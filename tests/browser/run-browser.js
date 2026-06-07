#!/usr/bin/env node

/**
 * Browser test runner using chrome-headless-shell.
 *
 * Bootstraps chrome-headless-shell if not present, starts a static dev server,
 * runs browser tests via --dump-dom, and reports results.
 *
 * Zero npm dependencies -- uses only Node.js built-in APIs.
 *
 * Usage:
 *   cd frontend && node tests/browser/run-browser.js
 *   npm run test:browser
 */

import { spawn, spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'fs';
import { createServer as createNetServer } from 'net';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir, platform as osPlatform, arch as osArch } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..', '..');
const repoRoot = join(frontendRoot, '..');
const chromeDir = join(repoRoot, 'chrome-headless-shell');

const API_URL = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';
const enableCoverage = process.argv.includes('--coverage');

/**
 * Reserve an ephemeral localhost port and release it immediately.
 * This avoids collisions with stale test servers on fixed ports.
 * @returns {Promise<number>}
 */
function pickServerPort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();

    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Failed to determine ephemeral server port')));
        return;
      }

      const { port } = address;
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
}

/**
 * Detect the platform string for Chrome for Testing.
 * @returns {string} Platform string (e.g., 'linux64', 'mac-arm64')
 */
function detectPlatform() {
  const plat = osPlatform();
  const arc = osArch();

  if (plat === 'linux' && arc === 'x64') return 'linux64';
  if (plat === 'linux' && arc === 'arm64') return 'linux-arm64';
  if (plat === 'darwin' && arc === 'arm64') return 'mac-arm64';
  if (plat === 'darwin' && arc === 'x64') return 'mac-x64';
  if (plat === 'win32' && arc === 'x64') return 'win64';
  if (plat === 'win32') return 'win32';

  throw new Error(`Unsupported platform: ${plat} ${arc}`);
}

/**
 * Find the chrome-headless-shell binary path for the given platform.
 * @param {string} platform
 * @returns {string} Path to the binary
 */
function getBinaryPath(platform) {
  if (platform === 'linux64' || platform === 'linux-arm64') {
    return join(chromeDir, `chrome-headless-shell-${platform}`, 'chrome-headless-shell');
  }
  if (platform === 'mac-arm64' || platform === 'mac-x64') {
    return join(chromeDir, `chrome-headless-shell-${platform}`, 'chrome-headless-shell.app', 'Contents', 'MacOS', 'chrome-headless-shell');
  }
  if (platform === 'win64' || platform === 'win32') {
    return join(chromeDir, `chrome-headless-shell-${platform}`, 'chrome-headless-shell.exe');
  }
  throw new Error(`Unknown platform: ${platform}`);
}

/**
 * Ensure chrome-headless-shell is downloaded and extracted.
 * @returns {string} Path to the binary
 */
async function ensureChrome() {
  const platform = detectPlatform();
  const versionFile = join(chromeDir, '.version');
  const binaryPath = getBinaryPath(platform);

  // Check if already installed and version matches
  if (existsSync(versionFile) && existsSync(binaryPath)) {
    const savedVersion = readFileSync(versionFile, 'utf-8').trim();
    console.log(`Using chrome-headless-shell ${savedVersion} (${platform})`);
    return binaryPath;
  }

  // Check for unzip
  const unzipCheck = spawnSync('which', ['unzip'], { encoding: 'utf-8' });
  if (unzipCheck.status !== 0) {
    throw new Error(
      'unzip command not found. Install with:\n' +
      '  Fedora:  sudo dnf install unzip\n' +
      '  Debian:  sudo apt install unzip\n' +
      '  macOS:   brew install unzip'
    );
  }

  // Fetch latest Stable version from Chrome for Testing API
  console.log('Fetching Chrome for Testing API...');
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Chrome for Testing API: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const channel = data.channels?.Stable;
  if (!channel) {
    throw new Error('No Stable channel found in Chrome for Testing API response');
  }

  const version = channel.version;
  const shellDownloads = channel.downloads?.['chrome-headless-shell'];
  if (!shellDownloads) {
    throw new Error('No chrome-headless-shell downloads found in API response');
  }

  const download = shellDownloads.find(d => d.platform === platform);
  if (!download) {
    const available = shellDownloads.map(d => d.platform).join(', ');
    throw new Error(`No chrome-headless-shell download for platform ${platform}. Available: ${available}`);
  }

  // Download the zip
  const zipName = `chrome-headless-shell-${platform}.zip`;
  const zipPath = join(tmpdir(), zipName);

  console.log(`Downloading chrome-headless-shell ${version} for ${platform}...`);
  const downloadResponse = await fetch(download.url);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download chrome-headless-shell: ${downloadResponse.status} ${downloadResponse.statusText}`);
  }

  const buffer = Buffer.from(await downloadResponse.arrayBuffer());
  writeFileSync(zipPath, buffer);
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  // Extract to chrome directory
  console.log('Extracting...');
  mkdirSync(chromeDir, { recursive: true });
  const unzipResult = spawnSync('unzip', ['-o', zipPath, '-d', chromeDir], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  rmSync(zipPath);

  if (unzipResult.status !== 0) {
    console.error('unzip stderr:', unzipResult.stderr);
    throw new Error(`Failed to extract chrome-headless-shell: ${unzipResult.stderr}`);
  }

  // Make binary executable
  chmodSync(binaryPath, 0o755);

  // Save version for future checks
  writeFileSync(versionFile, version);

  console.log(`Installed chrome-headless-shell ${version} to ${chromeDir}`);
  return binaryPath;
}

/**
 * Start the static dev server.
 * @param {number} port
 * @returns {{ process: import('child_process').ChildProcess, owned: boolean, port: number }}
 */
function startServer(port) {
  console.log(`Starting static test server on port ${port}...`);

  const serverArgs = ["scripts/test-dev-server.mjs", "--port", String(port)];
  if (enableCoverage) {
    serverArgs.push("--coverage");
  }

  const server = spawn("node", serverArgs, {
    cwd: frontendRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderr = '';
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  server.on('error', (err) => {
    stderr += `\nspawn error: ${err.message}`;
  });

  return { process: server, stderr: () => stderr, owned: true, port };
}

/**
 * Wait for the static dev server to be ready.
 * @param {number} port
 */
async function waitForServer(port) {
  const url = `http://127.0.0.1:${port}`;
  const maxAttempts = 40;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('Static test server is ready');
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(`Static test server did not start within ${maxAttempts * 500}ms`);
}

/**
 * Parse the test results from --dump-dom output.
 * @param {string} html
 * @returns {object} Test results object
 */
function parseDumpDomOutput(html) {
  const bodyStart = html.indexOf('<body');
  if (bodyStart === -1) {
    throw new Error('Could not find <body> in dump-dom output. Tests may not have completed.');
  }

  const bodyContentStart = html.indexOf('>', bodyStart) + 1;
  const bodyEnd = html.lastIndexOf('</body>');
  if (bodyEnd === -1) {
    throw new Error('Could not find </body> in dump-dom output.');
  }

  const jsonStr = html.slice(bodyContentStart, bodyEnd).trim();
  if (!jsonStr) {
    throw new Error('Body content is empty. Tests may not have completed.');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from body: ${e.message}\n\n` +
      `Body content (first 500 chars):\n${jsonStr.slice(0, 500)}`
    );
  }
}

/**
 * Run browser tests using chrome-headless-shell --dump-dom.
 * @param {string} binary - Path to chrome-headless-shell binary
 * @param {{ process: import('child_process').ChildProcess, owned: boolean, port: number }} serverInfo
 * @returns {object} Test results
 */
function runTests(binary, serverInfo) {
  const url = `http://127.0.0.1:${serverInfo.port}/?test=json`;

  console.log(`Running browser tests via chrome-headless-shell...`);

  const args = [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--virtual-time-budget=15000',
    '--dump-dom',
    url,
  ];

  const result = spawnSync(binary, args, {
    timeout: 60000,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = serverInfo.owned ? serverInfo.stderr() : '';
    console.error('chrome-headless-shell stderr:', result.stderr?.slice(0, 2000));
    if (stderr) {
      console.error('Static server stderr:', stderr.slice(0, 2000));
    }
    throw new Error(`chrome-headless-shell exited with code ${result.status}`);
  }

  return parseDumpDomOutput(result.stdout);
}

/**
 * Write coverage report from browser test results.
 * @param {object} result
 */
async function writeBrowserCoverage(result) {
  if (!enableCoverage || !result.coverage) {
    return;
  }

  const { findExecutableLines } = await import('../lib/coverage-instrument.js');
  const srcDir = join(frontendRoot, 'src');
  const allSourceFiles = findSourceFiles(srcDir);

  for (const filePath of allSourceFiles) {
    const relPath = filePath.replace(frontendRoot + '/', '');
    if (!result.coverage[relPath]) {
      const source = readFileSync(filePath, 'utf-8');
      const execLines = findExecutableLines(source);
      if (execLines.length > 0) {
        const lines = {};
        for (const n of execLines) lines[String(n)] = 0;
        result.coverage[relPath] = { lines };
      }
    }
  }

  const { writeLcovFile } = await import('../lib/coverage-lcov.js');
  const lcovPath = join(frontendRoot, 'coverage-browser.lcov');
  writeLcovFile(result.coverage, lcovPath, frontendRoot);
  console.log(`Browser coverage report written to: ${lcovPath}`);

  let totalLines = 0;
  let hitLines = 0;
  for (const data of Object.values(result.coverage)) {
    for (const count of Object.values(data.lines)) {
      totalLines++;
      if (count > 0) hitLines++;
    }
  }
  const pct = totalLines > 0 ? ((hitLines / totalLines) * 100).toFixed(1) : '0.0';
  console.log(`Browser line coverage: ${hitLines}/${totalLines} (${pct}%)`);
}

/**
 * Recursively find all .js files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function findSourceFiles(dir) {
  /** @type {string[]} */
  const results = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

/**
 * Stop the static dev server if we own it.
 * @param {{ process: import('child_process').ChildProcess, owned: boolean, port: number }} serverInfo
 */
function stopServer(serverInfo) {
  if (serverInfo.owned) {
    serverInfo.process.kill('SIGTERM');
    console.log('Static test server stopped');
  }
}

/**
 * Report test results to stdout.
 * @param {object} result
 */
function reportResults(result) {
  console.log('');
  console.log('='.repeat(60));
  console.log('Browser Test Results');
  console.log('='.repeat(60));
  console.log(`Passed:   ${result.passed}`);
  console.log(`Failed:   ${result.failed}`);
  console.log(`Skipped:  ${result.skipped}`);
  console.log(`Total:    ${result.passed + result.failed + result.skipped}`);
  console.log('');

  if (result.startupError) {
    console.log('Startup failure:');
    console.log(`  Phase:   ${result.startupError.phase}`);
    console.log(`  Message: ${result.startupError.message}`);
    if (result.startupError.stack) {
      console.log('');
      console.log(result.startupError.stack);
    }
    console.log('');
  }

  if (result.failed > 0 && result.results) {
    console.log('Failed tests:');
    for (const r of result.results) {
      if (r.status === 'failed') {
        console.log(`  FAIL: ${r.name}`);
        if (r.error) {
          console.log(`        ${r.error}`);
        }
      }
    }
    console.log('');
  }

  console.log('='.repeat(60));
}

/**
 * Main entry point.
 */
async function main() {
  let serverInfo = null;

  try {
    spawnSync("node", ["scripts/use-dev-index.mjs"], {
      cwd: frontendRoot,
      stdio: "inherit",
    });

    if (enableCoverage) {
      throw new Error("Browser coverage is not wired for the non-Vite test server yet");
    }

    // 1. Ensure chrome-headless-shell is installed
    const binary = await ensureChrome();

    // 2. Start static dev server
    const serverPort = await pickServerPort();
    serverInfo = startServer(serverPort);

    // 3. Wait for the server to be ready
    await waitForServer(serverInfo.port);

    // 4. Run browser tests
    const result = runTests(binary, serverInfo);

    // 5. Report results
    reportResults(result);

    // 6. Write coverage report if enabled
    await writeBrowserCoverage(result);

    // 7. Exit with appropriate code
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(2);
  } finally {
    if (serverInfo) {
      stopServer(serverInfo);
    }
  }
}

main();
