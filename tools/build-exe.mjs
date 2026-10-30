// Builds dist/LolDraftCoach.exe: one file for friends, nothing else to install.
// 1. esbuild bundles the companion into a single CommonJS file.
// 2. Node packs it with the page and the demo games into a blob (single executable application).
// 3. postject injects the blob into a copy of this node.exe.
// Usage: npm run build:exe

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, writeFileSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ASSET_FILES } from '../companion/assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = `${root}dist/`;
const exe = `${dist}LolDraftCoach.exe`;
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

mkdirSync(dist, { recursive: true });
rmSync(exe, { force: true });

await build({
  entryPoints: [`${root}companion/index.mjs`],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: `${dist}bundle.cjs`,
  external: ['bufferutil', 'utf-8-validate'], // optional speed-ups of ws
  logOverride: { 'empty-import-meta': 'silent' }, // only used when running from the repository
  logLevel: 'warning',
});

writeFileSync(
  `${dist}sea-config.json`,
  JSON.stringify({
    main: `${dist}bundle.cjs`,
    output: `${dist}sea-prep.blob`,
    disableExperimentalSEAWarning: true,
    assets: Object.fromEntries(ASSET_FILES.map((f) => [f, `${root}${f}`])),
  }, null, 2),
);
execFileSync(process.execPath, ['--experimental-sea-config', `${dist}sea-config.json`], { stdio: 'inherit' });

copyFileSync(process.execPath, exe);
execFileSync(process.execPath, [`${root}node_modules/postject/dist/cli.js`, exe, 'NODE_SEA_BLOB', `${dist}sea-prep.blob`, '--sentinel-fuse', FUSE, '--overwrite'], { stdio: 'inherit' });

console.log(`\n${exe} (${Math.round(statSync(exe).size / 1e6)} Mo)`);
