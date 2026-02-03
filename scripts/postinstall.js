const fs = require('fs');
const path = require('path');

function ensureDomAccessibilityApiEsmShim() {
  const distDir = path.resolve(
    process.cwd(),
    'node_modules',
    'dom-accessibility-api',
    'dist'
  );
  const cjsEntry = path.join(distDir, 'index.js');
  const esmEntry = path.join(distDir, 'index.mjs');

  if (!fs.existsSync(distDir) || !fs.existsSync(cjsEntry)) return;
  if (fs.existsSync(esmEntry)) return;

  const shim = `import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const api = require('./index.js');

export const computeAccessibleDescription = api.computeAccessibleDescription;
export const computeAccessibleName = api.computeAccessibleName;
export const getRole = api.getRole;
export const isDisabled = api.isDisabled;

export default api;
`;

  fs.writeFileSync(esmEntry, shim, 'utf8');
  // eslint-disable-next-line no-console
  console.log('[postinstall] Wrote dom-accessibility-api ESM shim:', path.relative(process.cwd(), esmEntry));
}

try {
  ensureDomAccessibilityApiEsmShim();
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('[postinstall] Non-fatal fixup failed:', error);
}
