// Test-only orchestration. Core code has no filesystem, process or Node imports.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
let tsc = process.env.ORBIT_TYPESCRIPT_PATH;
if (!tsc) {
  try { tsc = require.resolve('typescript/lib/tsc.js', {paths: [root]}); }
  catch { console.error('Use the declared TypeScript 5.7.3 dependency or set ORBIT_TYPESCRIPT_PATH to its tsc.js.'); process.exit(1); }
}
for (const args of [[tsc, '--version'], [tsc, '-p', 'tests/programmes/tsconfig.core.json'], ['--test', 'tests/programmes/core.test.cjs']]) {
  const result = spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
