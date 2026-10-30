// Bugs found by the audit of 30/10/2026, each checked on real data where there is some.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { adviseBuild } from '../companion/advise-build.mjs';
import { championInfo } from '../companion/static-data.mjs';
import { draftState } from '../companion/draft.mjs';
import { recommend } from '../companion/recommend.mjs';
import { assignBench } from '../companion/team.mjs';
import { startServer } from '../companion/server.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ddragon = read('./fixtures/ddragon-champions.json');
const info = championInfo(ddragon);
const champions = Object.fromEntries(Object.values(ddragon.data).map((c) => [c.key, { name: c.name, alias: c.id }]));
const items = read('./fixtures/items.json');
const build = read('./fixtures/build-nami-support.json'); // core: World Atlas line (3870), 6620, 3158
const live = read('./fixtures/live-sample.json');
const stats = { draft: read('./fixtures/draft-stats-mini.json'), mayhem: read('./fixtures/mayhem-stats.json') };
const withMyItems = (ids, gold) => {
  const me = live.allPlayers.find((p) => p.riotId === live.activePlayer.riotId);
  return {
    ...live,
    activePlayer: { ...live.activePlayer, currentGold: gold },
    allPlayers: live.allPlayers.map((p) => (p === me ? { ...p, items: ids.map((itemID, slot) => ({ itemID, slot, count: 1 })) } : p)),
  };
};

test('the support quest item is earned, never bought: any step of it fills its slot', () => {
  for (const quest of [3865, 3866, 3867, 3869]) {
    const a = adviseBuild(withMyItems([quest], 400), { build, items, info });
    assert.ok(!a.buy || (a.buy.for < 3865 || a.buy.for > 3877), `${quest}: ${JSON.stringify(a.buy)}`);
    assert.ok(a.path.some((p) => p.item === quest && p.owned), `${quest} stands for the quest slot`);
  }
});

test('ARAM copies of items (126697 for 6697) count as the item itself', () => {
  const me = live.allPlayers.find((p) => p.riotId === live.activePlayer.riotId);
  const ids = me.items.map((i) => i.itemID);
  const plain = adviseBuild(withMyItems(ids, 500), { build, items, info });
  const copies = adviseBuild(withMyItems(ids.map((id) => (items[id] ? id + 120000 : id)), 500), { build, items, info });
  assert.deepEqual(copies.path, plain.path);
  assert.deepEqual(copies.buy, plain.buy);
});

test('spectating (no active player) gives no build advice', () => {
  assert.equal(adviseBuild({ ...live, activePlayer: { error: 'spectator' } }, { build, items, info }), null);
});

test('no build data is told apart from a finished build', () => {
  const a = adviseBuild(live, { builds: {}, items, info });
  assert.equal(a.noBuild, true);
  assert.equal(adviseBuild(live, { build, items, info }).noBuild, false);
});

const aramDraft = (mine, bench, queueId = 2400) => ({
  kind: 'aram', queueId, phase: 'BAN_PICK', bans: { ally: [], enemy: [] }, enemies: [],
  allies: [{ cellId: 0, me: true, role: '', championId: mine, hoverId: 0 }], bench, allyBanHovers: [],
});

test('ARAM: a gap shown as "+1,0 pt" is a swap, as the legend promises', () => {
  const mayhem = { source: 'test', champs: { 24: { wr: 0.5341 }, 904: { wr: 0.5441 } } }; // Jax, Zaahen: 0.0099999
  const advice = recommend(aramDraft(24, [904]), { stats: { ...stats, mayhem }, profile: {}, champions, info });
  assert.equal(advice.verb, 'Prends');
  assert.equal(advice.focus, 904);
});

test('ARAM without public stats (normal ARAM): no advice dressed up as one', () => {
  const normal = recommend(aramDraft(246, [157, 1], 450), { stats, profile: {}, champions, info });
  assert.equal(normal.flat, true);
  assert.equal(normal.verb, 'Garde');
  assert.ok(normal.options.every((o) => o.low === o.p && o.high === o.p), 'no invented range');
});

test('ARAM bench split: friends never chase the same champion, and every companion agrees', () => {
  const dir = new URL('./fixtures/real/', import.meta.url);
  let checked = 0;
  for (const f of readdirSync(dir).filter((x) => x.startsWith('q2400'))) {
    const g = read(`./fixtures/real/${f}`);
    const session = g.events.find((e) => e.session.timer?.phase === 'FINALIZATION')?.session ?? g.events.at(-1).session;
    const team = session.myTeam.filter((p) => p.championId);
    if (team.length < 3) continue;
    // Seen from each friend's own PC: they are "self", the others are friends.
    const fromSeat = (seat) => assignBench(team.map((p) => {
      const draft = draftState({ ...session, localPlayerCellId: p.cellId });
      return { cellId: p.cellId, self: p.cellId === seat, friend: p.cellId !== seat, draft, advice: recommend(draft, { stats, profile: { unknown: true }, champions, info }) };
    }));
    const splits = team.map((p) => Object.fromEntries(fromSeat(p.cellId).map((v) => [v.cellId, v.advice?.assigned ?? null])));
    for (const s of splits) assert.deepEqual(s, splits[0], `${f}: two companions disagree`);
    const given = Object.values(splits[0]).filter(Boolean);
    assert.equal(new Set(given).size, given.length, `${f}: one champion for two friends`);
    checked++;
  }
  assert.ok(checked > 20, `${checked} selects checked`);
});

test('ARAM bench split: a stranger in the team never takes your best bench champion', () => {
  const g = read('./fixtures/real/q2400-2026-10-30-75.json');
  const session = g.events[10].session; // Ekko back on the bench
  const views = session.myTeam.map((p) => {
    const draft = draftState({ ...session, localPlayerCellId: p.cellId });
    return { cellId: p.cellId, self: p.cellId === session.localPlayerCellId, draft, advice: recommend(draft, { stats, profile: { unknown: true }, champions, info }) };
  });
  const mine = assignBench(views).find((v) => v.self).advice;
  assert.equal(mine.focus, 245, 'Ekko stays yours');
  assert.ok(mine.options.every((o) => !o.takenBy));
});

test('a malformed address answers 400 and the companion keeps running', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1', snapshot: () => ({ ok: true }) });
  try {
    const bad = await fetch(`http://127.0.0.1:${server.port}/%E0%A4%A`);
    assert.equal(bad.status, 400);
    const good = await fetch(`http://127.0.0.1:${server.port}/state`);
    assert.equal(good.status, 200);
  } finally {
    await server.close();
  }
});
