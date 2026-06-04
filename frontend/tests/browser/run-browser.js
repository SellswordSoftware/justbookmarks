#!/usr/bin/env node

/**
 * Browser test runner using chrome-headless-shell.
 *
 * Bootstraps chrome-headless-shell if not present, starts Vite dev server,
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
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir, platform as osPlatform, arch as osArch } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..', '..');
const repoRoot = join(frontendRoot, '..');
const chromeDir = join(repoRoot, 'chrome-headless-shell');

const API_URL = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';
const VITE_PORT = 5173;

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
 * Start the Vite dev server.
 * @returns {{ process: import('child_process').ChildProcess, owned: boolean }}
 */
function startVite() {
  console.log(`Starting Vite dev server on port ${VITE_PORT}...`);

  const vite = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host', '127.0.0.1'], {
    cwd: frontendRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });

  let stderr = '';
  vite.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  vite.on('error', (err) => {
    stderr += `\nspawn error: ${err.message}`;
  });

  return { process: vite, stderr: () => stderr, owned: true };
}

/**
 * Wait for the Vite dev server to be ready.
 * @param {number} port
 */
async function waitForVite(port) {
  const url = `http://127.0.0.1:${port}`;
  const maxAttempts = 40;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('Vite dev server is ready');
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(`Vite dev server did not start within ${maxAttempts * 500}ms`);
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
 * @param {{ process: import('child_process').ChildProcess, owned: boolean }} viteInfo
 * @returns {object} Test results
 */
function runTests(binary, viteInfo) {
  const url = `http://127.0.0.1:${VITE_PORT}/?test=json`;

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
    const stderr = viteInfo.owned ? viteInfo.stderr() : '';
    console.error('chrome-headless-shell stderr:', result.stderr?.slice(0, 2000));
    if (stderr) {
      console.error('Vite stderr:', stderr.slice(0, 2000));
    }
    throw new Error(`chrome-headless-shell exited with code ${result.status}`);
  }

  return parseDumpDomOutput(result.stdout);
}

/**
 * Stop the Vite dev server if we own it.
 * @param {{ process: import('child_process').ChildProcess, owned: boolean }} viteInfo
 */
function stopVite(viteInfo) {
  if (viteInfo.owned) {
    viteInfo.process.kill('SIGTERM');
    console.log('Vite dev server stopped');
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
  let viteInfo = null;

  try {
    // 1. Ensure chrome-headless-shell is installed
    const binary = await ensureChrome();

    // 2. Start Vite dev server
    viteInfo = startVite();

    // 3. Wait for Vite to be ready
    await waitForVite(VITE_PORT);

    // 4. Run browser tests
    const result = runTests(binary, viteInfo);

    // 5. Report results
    reportResults(result);

    // 6. Exit with appropriate code
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(2);
  } finally {
    if (viteInfo) {
      stopVite(viteInfo);
    }
  }
}

main();
