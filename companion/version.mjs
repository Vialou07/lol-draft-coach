// The app version: baked into the .exe at build time, read from package.json otherwise.

import { readFileSync } from 'node:fs';

/* global __LDC_VERSION__ */
export const VERSION = typeof __LDC_VERSION__ !== 'undefined'
  ? __LDC_VERSION__
  : JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// "0.2.10" > "0.2.9"
export function isNewer(candidate, current) {
  const a = String(candidate).replace(/^v/, '').split('.').map(Number);
  const b = String(current).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
