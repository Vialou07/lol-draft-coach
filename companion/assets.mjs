// Files shipped with the app (the page, the demo games). From the repository they are read
// from disk; inside the single .exe they are embedded assets.

import { readFile } from 'node:fs/promises';
import { getAsset } from 'node:sea';
import { isPackaged } from './paths.mjs';

// Embedded assets are named by their path in the repository, e.g. "web/index.html".
export const ASSET_FILES = [
  'web/index.html',
  'web/app.js',
  'web/style.css',
  'web/codec.js',
  'web/vendor/idiomorph.esm.js',
  'test/fixtures/real/q420-2026-10-24-03.json',
  'test/fixtures/real/q2400-2026-10-24-40.json',
  'test/fixtures/live-sample.json',
  'test/fixtures/game-detail-galio.json',
];

export async function readAsset(path) {
  if (isPackaged()) return Buffer.from(getAsset(path));
  return readFile(new URL(`../${path}`, import.meta.url));
}
