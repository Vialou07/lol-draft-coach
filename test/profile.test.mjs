import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.LDC_DATA_DIR = mkdtempSync(join(tmpdir(), 'ldc-profile-'));
const { startFakeClient, loadFixture } = await import('./fake-client.mjs');
const { buildProfile } = await import('../companion/profile.mjs');
const { findClient } = await import('../companion/lcu.mjs');

const game = (gameId, championId, win, extra = {}) => ({ gameId, queueId: 2400, gameDuration: 1100, participants: [{ championId, stats: { win, ...extra.stats } }], ...extra.game });

test('profile: remakes do not count, and your games add up past the 20 the client keeps', async () => {
  const profile = {
    mastery: [],
    ranked: {},
    games: [
      game(1, 236, true, { game: { gameDuration: 106 }, stats: { gameEndedInEarlySurrender: true } }), // a remake "won"
      game(2, 3, false),
      game(3, 3, true),
    ],
  };
  const lockfile = join(tmpdir(), `ldc-profile-${process.pid}.lockfile`);
  const fake = await startFakeClient({ fixture: loadFixture('q2400-2026-10-30-75.json'), lockfile, profile });
  try {
    const client = findClient(lockfile);
    const first = await buildProfile(client);
    assert.equal(first.champions[236]?.games ?? 0, 0, 'remake not counted');
    assert.deepEqual(first.champions[3].byQueue[2400], { games: 2, wins: 1 });
    profile.games = [game(4, 3, true)]; // the older games have left the client's window
    const later = await buildProfile(client);
    assert.deepEqual(later.champions[3].byQueue[2400], { games: 3, wins: 2 }, 'kept games still count');
    assert.equal(later.gamesRead, 3);
  } finally {
    await fake.stop();
  }
});
