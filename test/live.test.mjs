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

test('roles: measured on real games when known, the client tags otherwise; two threats per team', async () => {
  const { compactMayhemDb } = await import('../companion/stats-mayhem-db.mjs');
  const { rolesOf, teamRoles, augmentAdvice } = await import('../companion/roles.mjs');
  const tier = { patch_prefix: '16.21', champs: {
    3: { wr: 0.51, g: 42550, comp: { phys: 275, magic: 1312, true: 124, front: 2.8, engage: 1.19, poke: 0.6, sustain: 1.57, cc: 2.73, damage: 0.43 } },
    96: { wr: 0.5, g: 30000, comp: { phys: 643, magic: 1361, true: 376, front: 0.56, engage: 0.22, poke: 2.7, sustain: 0.47, cc: 0.74, damage: 2.77 } },
  } };
  const augmentStats = { 3: { kPrismatic: [{ id: 1, g: 9000, wr: 0.56, lift: 0.05 }, { id: 2, g: 100, wr: 0.7, lift: 0.2 }, { id: 3, g: 5000, wr: 0.49, lift: -0.02 }] } };
  const db = compactMayhemDb(tier, augmentStats);
  assert.deepEqual(db.champs[3].games, 42550);
  assert.deepEqual(rolesOf('3', { db }), ['Tank', 'Contrôles']);
  assert.deepEqual(rolesOf('96', { db }).sort(), ['Gros dégâts', 'Poke']);
  assert.deepEqual(db.augments[3].kPrismatic.map((a) => a.id), [1], 'too few games or no gain: left out');
  const advice = augmentAdvice('3', { db, names: { 1: { name: 'Goliath', icon: null } } });
  assert.equal(advice.byRarity.kPrismatic[0].name, 'Goliath');
  const roles = teamRoles(live, { items, db, keyOf: (p) => (p.championName === 'Galio' ? '3' : null) });
  for (const team of [roles.allies, roles.enemies]) {
    assert.equal(team.length, 5);
    assert.equal(team.filter((x) => x.top).length, 2, 'two threats per team');
    assert.ok(Math.abs(team.reduce((s, x) => s + x.threat, 0) - 1) < 1e-9, 'shares add up to the team');
  }
  assert.ok(roles.allies.find((x) => x.me).roles.includes('Tank'));
});
