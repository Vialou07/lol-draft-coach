// End to end: fake League client -> companion -> websocket client (what the page receives).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { startFakeClient, loadFixture } from './fake-client.mjs';
import { startCompanion as start } from '../companion/app.mjs';
import { readFileSync } from 'node:fs';
import { championInfo } from '../companion/static-data.mjs';

// Frozen stats so the tests never depend on the network.
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const stats = { draft: read('./fixtures/draft-stats-mini.json'), mayhem: read('./fixtures/mayhem-stats.json') };
const info = championInfo(read('./fixtures/ddragon-champions.json'));
const startCompanion = (opts) => start({ ...opts, share: false, loadStats: async () => stats, loadInfo: async () => info, loadAttrs: null, loadElo: null });

const waitFor = async (check, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timeout');
};

async function run(fixtureFile, name) {
  const lockfile = join(tmpdir(), `lol-draft-coach-${name}.lockfile`);
  const fixture = loadFixture(fixtureFile);
  const fake = await startFakeClient({ fixture, lockfile, speed: 200 });
  const app = await startCompanion({ port: 0, host: '127.0.0.1', lockfile });
  const page = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
  const states = [];
  page.on('message', (m) => states.push(JSON.parse(m.toString())));
  await waitFor(() => fake.subscribers() > 0 && states.at(-1)?.status === 'connected');
  await fake.play();
  await waitFor(() => states.at(-1)?.status === 'connected' && states.at(-1)?.gameflow === 'InProgress');
  return { fixture, fake, app, page, states, lockfile };
}

const cleanup = async ({ fake, app, page }) => {
  page.close();
  await app.stop();
  await fake.stop();
};

test('ranked solo: the page receives the live draft, then the end of champ select', async () => {
  const r = await run('q420-2026-10-24-01.json', 'ranked');
  try {
    const drafts = r.states.filter((s) => s.status === 'champ-select');
    assert.ok(drafts.length >= 10, `draft updates received: ${drafts.length}`);
    assert.equal(drafts[0].queue?.gameMode, 'CLASSIC');
    const last = drafts.at(-1).draft;
    assert.equal(last.kind, 'draft');
    assert.equal(last.allies.filter((p) => p.championId).length, 5);
    assert.equal(last.enemies.filter((p) => p.championId).length, 5);
    assert.equal(r.states.at(-1).draft, null);
    assert.equal(r.states.at(-1).summoner?.gameName, 'Testeur');
    assert.ok(Object.keys(r.states.at(-1).champions).length > 150);
    const withAdvice = drafts.filter((s) => s.advice?.options?.length);
    assert.ok(withAdvice.length > 0, 'advice reached the page');
    assert.ok(withAdvice.some((s) => s.advice.verb === 'À toi'), 'pick advice during my turn');
  } finally {
    await cleanup(r);
  }
});

test('ARAM Mayhem: bench and my champion reach the page, mode is KIWI', async () => {
  const r = await run('q2400-2026-10-25-50.json', 'aram');
  try {
    const drafts = r.states.filter((s) => s.status === 'champ-select');
    assert.equal(drafts[0].queue?.gameMode, 'KIWI');
    const last = drafts.at(-1).draft;
    assert.equal(last.kind, 'aram');
    assert.ok(last.bench.length >= 3);
    assert.ok(last.allies.find((p) => p.me).championId > 0);
  } finally {
    await cleanup(r);
  }
});

test('the companion survives the client closing and reconnects when it comes back', async () => {
  const lockfile = join(tmpdir(), 'lol-draft-coach-restart.lockfile');
  const fixture = loadFixture('q2400-2026-10-25-50.json');
  let fake = await startFakeClient({ fixture, lockfile });
  const app = await startCompanion({ port: 0, host: '127.0.0.1', lockfile });
  try {
    await waitFor(() => app.state.status === 'connected');
    await fake.stop();
    await waitFor(() => app.state.status === 'no-client');
    fake = await startFakeClient({ fixture, lockfile });
    await waitFor(() => app.state.status === 'connected', 10000);
    await waitFor(() => fake.subscribers() > 0);
    await fake.play();
    await waitFor(() => app.state.gameflow === 'InProgress');
  } finally {
    await app.stop();
    await fake.stop();
  }
});

test('the live page and its files are served', async () => {
  const app = await startCompanion({ port: 0, host: '127.0.0.1', lockfile: join(tmpdir(), 'none.lockfile') });
  try {
    const home = await fetch(`http://127.0.0.1:${app.port}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<html/i);
    const state = await (await fetch(`http://127.0.0.1:${app.port}/state`)).json();
    assert.equal(state.status, 'no-client');
    const escape = await fetch(`http://127.0.0.1:${app.port}/..%2fpackage.json`);
    assert.notEqual(escape.status, 200);
  } finally {
    await app.stop();
  }
});
