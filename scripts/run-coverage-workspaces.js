#!/usr/bin/env node

/**
 * Workspace Coverage Runner
 *
 * Runs `test:coverage` for each workspace that defines it.
 * - Skips workspaces with no `test:coverage` script
 * - Continues on failures (so one broken workspace doesn't block overall coverage)
 *
 * This intentionally only targets the declared monorepo workspaces
 * (api, web-client, auth-main, packages/*). It does not include clawhub-main.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const workspaces = [
  { id: 'api', pkg: '@moltstudios/api', dir: 'api' },
  { id: 'web-client', pkg: '@moltstudios/web-client', dir: 'web-client' },
  { id: 'auth-main', pkg: '@moltstudios/auth', dir: 'auth-main' },
  { id: 'packages/rate-limiter', pkg: '@moltstudios/rate-limiter', dir: 'packages/rate-limiter' },
  { id: 'packages/voting', pkg: '@moltstudios/voting', dir: 'packages/voting' },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasScript(workspaceDir, scriptName) {
  const pkgPath = path.join(rootDir, workspaceDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = readJson(pkgPath);
  return Boolean(pkg?.scripts?.[scriptName]);
}

function runWorkspaceCoverage(ws) {
  if (!hasScript(ws.dir, 'test:coverage')) {
    return { workspace: ws.id, status: 'skipped', reason: 'no test:coverage script' };
  }

  const res = spawnSync(
    'npm',
    ['run', 'test:coverage', '--workspace', ws.pkg],
    { cwd: rootDir, encoding: 'utf8' }
  );

  if ((res.status ?? 1) === 0) {
    return { workspace: ws.id, status: 'ok' };
  }

  const stderr = (res.stderr || '').trim();
  const stdout = (res.stdout || '').trim();

  return {
    workspace: ws.id,
    status: 'failed',
    exitCode: res.status ?? 1,
    // Keep this short to avoid spewing massive logs.
    tail: (stderr || stdout).split('\n').slice(-20).join('\n'),
  };
}

function main() {
  console.log('🧪 Running workspace coverage (non-fatal)...\n');

  const results = workspaces.map(runWorkspaceCoverage);

  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  for (const r of results) {
    if (r.status === 'ok') console.log(`  ✓ ${r.workspace}: coverage ok`);
    else if (r.status === 'skipped') console.log(`  - ${r.workspace}: skipped (${r.reason})`);
    else console.log(`  ✗ ${r.workspace}: failed (exit ${r.exitCode})`);
  }

  console.log(`\nSummary: ${ok} ok, ${skipped} skipped, ${failed} failed\n`);

  if (failed) {
    console.log('Failures (last ~20 lines each):\n');
    for (const r of results.filter((x) => x.status === 'failed')) {
      console.log(`--- ${r.workspace} ---`);
      console.log(r.tail || '(no output)');
      console.log('');
    }
  }

  // Never fail the overall command; the merger will decide if enough reports exist.
  process.exit(0);
}

main();
