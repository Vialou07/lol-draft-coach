// Riot rule and project rule: the companion never writes to the League client.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../companion/', import.meta.url);
const sources = Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]));

test('the LCU bridge only issues GET requests', () => {
  const lcu = sources['lcu.mjs'];
  assert.doesNotMatch(lcu, /method\s*:/, 'no explicit HTTP method');
  assert.doesNotMatch(lcu, /https\.request\(/, 'only https.get');
  assert.doesNotMatch(lcu, /execSync|spawn|exec\(/, 'no process inspection');
});

test('the websocket only subscribes (WAMP type 5)', () => {
  const sends = [...sources['lcu.mjs'].matchAll(/\.send\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(sends.length > 0);
  for (const s of sends) assert.match(s, /\[5,/);
});

test('no other module talks to the client directly', () => {
  for (const [f, src] of Object.entries(sources)) {
    if (f === 'lcu.mjs') continue;
    assert.doesNotMatch(src, /127\.0\.0\.1|riot:\$\{/, `${f} must go through lcu.mjs`);
  }
});
