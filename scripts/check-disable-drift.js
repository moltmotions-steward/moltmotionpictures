const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = ['node_modules', 'dist', 'build', '.next', 'coverage', '.git', '.jules', '_generated', 'generated'];
const EXCLUDE_FILES = ['package-lock.json', 'bun.lock'];
const SCAN_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx'];
const DRIFT_PATTERNS = [
  'eslint-disable',
  'ts-ignore',
  'ts-expect-error',
  'ts-nocheck',
  'prettier-ignore',
  'nosemgrep',
  'nosec',
  'NOSONAR',
  'nolint',
  'dangerouslySetInnerHTML'
];

let failed = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (EXCLUDE_DIRS.includes(file)) continue;
      scanDir(fullPath);
    } else {
      if (EXCLUDE_FILES.includes(file)) continue;
      if (file.includes('.gen.') || file.endsWith('.d.ts')) continue; // Exclude generated/type def files
      if (!SCAN_EXTENSIONS.includes(path.extname(file))) continue;

      const content = fs.readFileSync(fullPath, 'utf8');

      // Check for file-level excludes (e.g., generated headers)
      if (content.includes('@generated') || content.includes('GENERATED CODE')) continue;

      const lines = content.split('\n');
      lines.forEach((line, index) => {
        for (const pattern of DRIFT_PATTERNS) {
          if (line.includes(pattern)) {
             // Check for inline justification
             // We allow if there is a description after the directive

             // Strip comment markers and the directive itself
             const stripped = line
                .replace(pattern, '')
                .replace(/\/\//g, '') // remove //
                .replace(/\/\*/g, '') // remove /*
                .replace(/\*\//g, '') // remove */
                .replace(/@/g, '')    // remove @ (common in @ts-ignore)
                .trim();

             // If there is meaningful text (e.g. > 3 chars) left, we consider it justified
             if (stripped.length > 3) {
                 continue;
             }

             console.error(`[DRIFT] Found '${pattern}' in ${path.relative(ROOT_DIR, fullPath)}:${index + 1} without justification`);
             console.error(`        Line: ${line.trim()}`);
             failed = true;
          }
        }
      });
    }
  }
}

console.log('🔍 Scanning for disable drift...');
try {
  scanDir(ROOT_DIR);
} catch (error) {
  console.error('Error scanning directories:', error);
  process.exit(1);
}

if (failed) {
  console.error('❌ Disable drift detected! Please remove suppressed checks or add justification.');
  process.exit(1);
} else {
  console.log('✅ No disable drift found.');
}
