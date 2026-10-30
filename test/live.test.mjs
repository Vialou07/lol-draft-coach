// In-game timeline from successive Live Client Data reads, and the post-game recap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trackLive } from '../companion/live-track.mjs';
import { gameRecap, augmentInfo } from '../companion/recap.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const items = read('./fixtures/items.json');
const live = read('./fixtures/live-galio-ap.json'); // a real ARAM Mayhem read, names anonymised
const me = live.allPlayers.find((p) => p.riotId === live.activePlayer.riotId);
const enemy = live.allPlayers.find((p) => p.team !== me.team);
const at = (t, change = (p) => p) => ({ ...live, gameData: { ...live.gameData, gameTime: t }, allPlayers: live.allPlayers.map(change) });
const name = (p) => p.riotIdGameName ?? p.riotId.split('#')[0];

test('the gold curve: item value of both teams, one point every ten seconds plus the latest', () => {
  let track = null;
  for (const t of [100, 103, 106, 111, 114]) track = trackLive(track, at(t), { items });
  assert.deepEqual(track.view.points.map((p) => p[0]), [100, 111, 114]);
  const paused = [114, 114, 114].reduce((tr, t) => trackLive(tr, at(t), { items }), track);
  assert.deepEqual(paused.view.points.map((p) => p[0]), [100, 111, 114], 'a paused game adds no point');
  const worth = (team) => live.allPlayers.filter((p) => (p.team === me.team) === team).flatMap((p) => p.items).reduce((s, i) => s + (items[i.itemID]?.cost ?? 0) * (i.count ?? 1), 0);
  assert.equal(track.view.gold.us, worth(true));
  assert.equal(track.view.gold.them, worth(false));
  assert.equal(track.view.points.at(-1)[1], worth(true) - worth(false));
});

test('an enemy finishing a big item shows in the key moments; a new game starts a new curve', () => {
  const bigItem = Object.entries(items).find(([, i]) => i.cost >= 3000 && !i.tags?.includes('Boots'))[0];
  const without = trackLive(null, at(200), { items });
  const withIt = trackLive(without, at(215, (p) => (p === enemy ? { ...p, items: [...p.items, { itemID: Number(bigItem), count: 1, slot: 5 }] } : p)), { items, championOf: () => 99 });
  const moment = withIt.view.feed.find((f) => f.kind === 'item');
  assert.equal(moment?.item, Number(bigItem));
  assert.equal(moment.ally, false);
  assert.match(moment.text, new RegExp(enemy.championName));
  const next = trackLive(withIt, at(20), { items });
  assert.equal(next.view.points.length, 1, 'time went back: another game');
});

test('kills, numbers alive and respawn timers come from what the scoreboard shows', () => {
  const events = { Events: [
    { EventName: 'ChampionKill', EventTime: 50.2, KillerName: name(me), VictimName: name(enemy) },
    { EventName: 'ChampionKill', EventTime: 80.7, KillerName: name(enemy), VictimName: name(me) },
    { EventName: 'Multikill', EventTime: 90, KillerName: name(me), KillStreak: 3 },
  ] };
  const read2 = { ...at(120, (p) => (p === enemy ? { ...p, isDead: true, respawnTimer: 11.6 } : { ...p, isDead: false, respawnTimer: 0 })), events };
  const v = trackLive(null, read2, { items, championOf: () => 3 }).view;
  assert.deepEqual(v.kills, [[50, 1], [81, 0]]);
  assert.deepEqual(v.score, { us: 1, them: 1 });
  assert.deepEqual(v.alive, { us: 5, them: 4 });
  assert.deepEqual(v.dead, [{ championId: 3, ally: false, left: 12 }]);
  assert.match(v.feed[0].text, /Triple kill/);
});

test('ARAM gives no inhibitor timer (undocumented), the Rift does (five minutes)', () => {
  const events = { Events: [{ EventName: 'InhibKilled', EventTime: 600, InhibKilled: me.team === 'ORDER' ? 'Barracks_T2_L1' : 'Barracks_T1_L1', KillerName: name(me) }] };
  const aram = trackLive(null, { ...at(650), events }, { items }).view;
  assert.equal(aram.timers.length, 0);
  assert.match(aram.feed[0].text, /Leur inhibiteur/);
  const rift = trackLive(null, { ...at(650), gameData: { ...live.gameData, gameTime: 650, gameMode: 'CLASSIC' }, events }, { items }).view;
  assert.deepEqual(rift.timers, [{ kind: 'inhib', ally: true, back: 900 }]);
});

test('the recap of a real game: ten players, your line, damage, healing and your augments', () => {
  const detail = read('./fixtures/game-detail-galio.json');
  const recap = gameRecap(detail, { puuid: 'me', augments: augmentInfo(read('./fixtures/augments-sample.json')) });
  assert.equal(recap.players.length, 10);
  const mine = recap.players.find((p) => p.me);
  assert.equal(mine.championId, 3);
  assert.equal(recap.win, true);
  assert.equal(mine.damage, 51772);
  assert.equal(recap.players.filter((p) => p.ally).length, 5);
  assert.equal(mine.augments.length, 4);
  for (const id of mine.augments) assert.ok(recap.augments[id]?.name && recap.augments[id].icon.startsWith('https://raw.communitydragon.org/'));
  assert.equal(gameRecap(detail, { puuid: 'nobody' }), null);
});
