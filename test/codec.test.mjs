// Group messages travel through a public broker: only the group key can open them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { importKey, encode, decode, toB64url, fromB64url } from '../web/codec.js';

test('a group message survives the round trip, compressed and encrypted', async () => {
  const key = await importKey(toB64url(randomBytes(32)));
  const message = { v: 1, name: 'Thomas', views: [{ name: 'Max', advice: { options: [{ championId: 267, p: 0.54 }] } }], filler: 'x'.repeat(5000) };
  const bytes = await encode(message, key);
  assert.ok(bytes.length < 1000, `compressed: ${bytes.length} bytes`);
  assert.deepEqual(await decode(bytes, key), message);
  assert.ok(!Buffer.from(bytes).toString('latin1').includes('Thomas'), 'nothing readable in transit');
});

test('another key cannot read it', async () => {
  const bytes = await encode({ secret: true }, await importKey(toB64url(randomBytes(32))));
  await assert.rejects(decode(bytes, await importKey(toB64url(randomBytes(32)))));
});

test('base64url keys round-trip', () => {
  const raw = randomBytes(32);
  assert.deepEqual(Buffer.from(fromB64url(toB64url(raw))), raw);
});
