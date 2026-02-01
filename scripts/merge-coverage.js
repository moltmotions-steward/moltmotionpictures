#!/usr/bin/env node

/**
 * Coverage Report Merger
 *
 * Combines coverage reports from all workspaces into a single consolidated view.
 * Outputs a merged coverage summary to console and HTML report.
 *
 * Usage: node scripts/merge-coverage.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const workspaces = ['api', 'web-client', 'auth-main', 'packages/rate-limiter', 'packages/voting'];

function findCoverageReports() {
  const reports = [];

  for (const workspace of workspaces) {
    const coverageDir = path.join(rootDir, workspace, 'coverage');

    if (fs.existsSync(coverageDir)) {
      const coverageFile = path.join(coverageDir, 'coverage-final.json');

      if (fs.existsSync(coverageFile)) {
        reports.push({
          workspace,
          path: coverageFile,
          data: JSON.parse(fs.readFileSync(coverageFile, 'utf-8')),
        });
      }
    }
  }

  return reports;
}

function mergeCoverage(reports) {
  const merged = {};

  for (const report of reports) {
    Object.assign(merged, report.data);
  }

  return merged;
}

function calculateStats(coverage) {
  let lines = 0;
  let linesValid = 0;
  let statements = 0;
  let statementsValid = 0;
  let branches = 0;
  let branchesValid = 0;
  let functions = 0;
  let functionsValid = 0;

  for (const file in coverage) {
    const data = coverage[file];

    if (data.l) {
      const lineValues = Object.values(data.l);
      lines += lineValues.length;
      linesValid += lineValues.filter((v) => v > 0).length;
    }

    if (data.s) {
      const statementValues = Object.values(data.s);
      statements += statementValues.length;
      statementsValid += statementValues.filter((v) => v > 0).length;
    }

    if (data.b) {
      const branchValues = Object.values(data.b).flat();
      branches += branchValues.length;
      branchesValid += branchValues.filter((v) => v > 0).length;
    }

    if (data.f) {
      const functionValues = Object.values(data.f);
      functions += functionValues.length;
      functionsValid += functionValues.filter((v) => v > 0).length;
    }
  }

  return {
    lines: lines > 0 ? ((linesValid / lines) * 100).toFixed(2) : '0.00',
    statements: statements > 0 ? ((statementsValid / statements) * 100).toFixed(2) : '0.00',
    branches: branches > 0 ? ((branchesValid / branches) * 100).toFixed(2) : '0.00',
    functions: functions > 0 ? ((functionsValid / functions) * 100).toFixed(2) : '0.00',
  };
}

function main() {
  console.log('📊 Merging coverage reports...\n');

  const reports = findCoverageReports();

  if (reports.length === 0) {
    console.warn('⚠️  No coverage reports found. Run `npm run test:coverage --workspaces` first.');
    process.exit(1);
  }

  console.log(`Found ${reports.length} coverage reports:\n`);
  for (const report of reports) {
    console.log(`  ✓ ${report.workspace}`);
  }

  const merged = mergeCoverage(reports);
  const stats = calculateStats(merged);

  console.log('\n📈 Combined Coverage Summary:\n');
  console.log(`  Lines:       ${stats.lines}%`);
  console.log(`  Statements:  ${stats.statements}%`);
  console.log(`  Branches:    ${stats.branches}%`);
  console.log(`  Functions:   ${stats.functions}%`);
  console.log('\n✅ Coverage merged successfully!');
}

main();
