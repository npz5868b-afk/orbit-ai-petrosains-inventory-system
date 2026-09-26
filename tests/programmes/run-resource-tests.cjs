// No new dependencies: existing strict TypeScript configuration plus Node test runner.
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
let tsc = process.env.ORBIT_TYPESCRIPT_PATH;
if (!tsc) tsc = require.resolve('typescript/lib/tsc.js', {paths: [root]});
for (const args of [[tsc, '--version'], [tsc, '-p', 'tests/programmes/tsconfig.core.json'], ['--test', 'tests/programmes/core.test.cjs', 'tests/programmes/resources.test.cjs']]) {
  const r = spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit'});
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}
