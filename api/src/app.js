/**
 * Test harness compatibility shim.
 *
 * Layer1 integration tests use CommonJS `require('../../src/app')`.
 * Prefer compiled dist output when present; otherwise transpile TS on the fly.
 */
try {
  module.exports = require('../dist/app.js');
} catch {
  require('tsx/cjs');
  module.exports = require('./app.ts');
}
