/**
 * Test harness compatibility shim.
 *
 * Layer1 integration tests use CommonJS `require('../../src/app')`.
 * Prefer compiled dist output when present; otherwise transpile TS on the fly.
 */
const isTestRuntime =
  process.env.NODE_ENV === 'test' ||
  !!process.env.VITEST ||
  !!process.env.VITEST_POOL_ID ||
  !!process.env.VITEST_WORKER_ID;

if (isTestRuntime) {
  require('tsx/cjs');
  module.exports = require('./app.ts');
} else {
  try {
    module.exports = require('../dist/app.js');
  } catch {
    require('tsx/cjs');
    module.exports = require('./app.ts');
  }
}
