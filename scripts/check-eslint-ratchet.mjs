/**
 * ESLint error-count ratchet — single source of truth for CI and pre-push.
 *
 * Mirrors the former inline block in `.github/workflows/test.yml`. Lower
 * BASELINE when the real count drops; never raise it without an explicit
 * decision. Do not use `npm run lint` here: that script passes `--fix`.
 *
 * Usage: node scripts/check-eslint-ratchet.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/** Must match the last known green CI count. Lower when count drops. */
const BASELINE = 891;

const GLOB = '{src,apps,libs,test}/**/*.ts';
const reportPath = join(process.cwd(), 'eslint.json');

const eslint = spawnSync(
  'npx',
  ['eslint', GLOB, '-f', 'json', '-o', reportPath],
  {
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

// ESLint exits 1 when it reports errors; that is expected under a ratchet.
if (eslint.error) {
  console.error(eslint.error);
  process.exit(1);
}
if (eslint.status !== 0 && eslint.status !== 1) {
  console.error(eslint.stderr || eslint.stdout || `eslint exited ${eslint.status}`);
  process.exit(eslint.status ?? 1);
}

let results;
try {
  results = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error('Failed to read eslint JSON report:', err.message);
  process.exit(1);
}

const count = results.reduce((sum, file) => sum + (file.errorCount || 0), 0);
console.log(`eslint reported ${count} error(s); baseline is ${BASELINE}`);

if (count > BASELINE) {
  const isCi = Boolean(process.env.GITHUB_ACTIONS);
  const prefix = isCi ? '::error::' : '';
  console.error(
    `${prefix}${count} lint errors, above the baseline of ${BASELINE}.`,
  );
  // Human-readable detail (same as CI used to dump on failure).
  spawnSync('npx', ['eslint', GLOB], {
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
  });
  process.exit(1);
}

if (count < BASELINE) {
  const isCi = Boolean(process.env.GITHUB_ACTIONS);
  const msg = `Down to ${count}. Lower BASELINE in scripts/check-eslint-ratchet.mjs to ${count}.`;
  console.log(isCi ? `::notice::${msg}` : msg);
}

try {
  unlinkSync(reportPath);
} catch {
  // report is gitignored; leaving it is harmless
}

process.exit(0);
