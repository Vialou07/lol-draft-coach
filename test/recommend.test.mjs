import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { draftState } from '../companion/draft.mjs';
import { recommend } from '../companion/recommend.mjs';
import { createDraftModel } from '../companion/model-draft.mjs';
import { championInfo } from '../companion/static-data.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const stats = { draft: read('./fixtures/draft-stats-mini.json') };
const ddragon = read('./fixtures/ddragon-champions.json');
const info = championInfo(ddragon);
const champions = Object.fromEntries(Object.values(ddragon.data).map((c) => [c.key, { name: c.name, alias: c.id }]));
const dir = new URL('./fixtures/real/', import.meta.url);
const ranked = readdirSync(dir).filter((f) => /^q4[24]0/.test(f)).map((f) => ({ file: f, ...read(`./fixtures/real/${f}`) }));

const profile = {
  champions: {
    893: { mastery: 150000, games: 40, wins: 22, byQueue: { 420: { games: 40, wins: 22 } } },
    103: { mastery: 30000, games: 12, wins: 6, byQueue: { 420: { games: 12, wins: 6 } } },
  },
};

const advise = (session) => {
  const draft = draftState(session);
  return { draft, advice: recommend(draft, { stats, profile, champions, info }) };
};

test('advice is produced at every moment of every real ranked draft, without errors', () => {
  let picks = 0;
  for (const g of ranked) {
    for (const { session } of g.events) {
      const { draft, advice } = advise(session);
      assert.ok(advice, `${g.file}: advice`);
      for (const o of advice.options) {
        assert.ok(!draft.bans.ally.includes(o.championId) && !draft.bans.enemy.includes(o.championId), 'banned champion suggested');
        if (o.p != null) {
          assert.ok(o.p > 0.25 && o.p < 0.75, `implausible win chance ${o.p}`);
          assert.ok(o.low <= o.p && o.p <= o.high);
        }
      }
      if (draft.myTurn === 'pick') {
        picks++;
        assert.ok(advice.options.length >= 2, 'several pick options');
        const taken = new Set([...draft.allies, ...draft.enemies].map((p) => p.championId).filter(Boolean));
        for (const o of advice.options) assert.ok(!taken.has(o.championId), 'already picked champion suggested');
        const ps = advice.options.map((o) => o.p);
        assert.deepEqual(ps, [...ps].sort((a, b) => b - a), 'sorted by win chance');
      }
    }
  }
  assert.ok(picks > 0, 'at least one pick turn replayed');
});

test('ban turn gives three bans that are still available', () => {
  for (const g of ranked) {
    const e = g.events.find(({ session }) => draftState(session).myTurn === 'ban');
    if (!e) continue;
    const { draft, advice } = advise(e.session);
    assert.equal(advice.verb, 'Ban conseillé');
    assert.equal(advice.options.length, 3);
    for (const o of advice.options) assert.ok(!draft.allyBanHovers.includes(o.championId));
  }
});

test('once locked, the page shows the win chance of the locked champion only', () => {
  const g = ranked.find((g) => g.queueId === 420);
  const { draft, advice } = advise(g.events.at(-1).session);
  const me = draft.allies.find((p) => p.me);
  assert.equal(advice.options.length, 1);
  assert.equal(advice.options[0].championId, me.championId);
});

test('mastery: never played costs several points, a known champion does not', () => {
  const model = createDraftModel(stats.draft, { difficulty: { 103: 5 } });
  const fresh = model.mastery('103', { champions: {} });
  const known = model.mastery('103', { champions: { 103: { mastery: 0, byQueue: { 420: { games: 30, wins: 15 } } } } });
  const pts = (x) => x * 25;
  assert.ok(pts(fresh.value) < -4 && pts(fresh.value) > -8, `fresh ${pts(fresh.value)}`);
  assert.ok(Math.abs(pts(known.value)) < 1.5, `known ${pts(known.value)}`);
});

test('matchups are shrunk: a pair never seen is neutral, a lopsided lane keeps its sign', () => {
  const model = createDraftModel(stats.draft);
  assert.equal(model.matchup('893', 2, '99999', 2).value, 0);
  // Find the most lopsided mid matchup with a big sample in the data and check its sign survives.
  let best = null;
  for (const [k, rec] of Object.entries(stats.draft.mu)) {
    const [c, r] = k.split(':');
    if (r !== '2') continue;
    for (const [k2, [g, w]] of Object.entries(rec)) {
      const [r2, e] = k2.split(':');
      if (r2 !== '2' || g < 3000) continue;
      if (!best || Math.abs(w / g - 0.5) > Math.abs(best.wr - 0.5)) best = { c, e, wr: w / g };
    }
  }
  const m = model.matchup(best.c, 2, best.e, 2).value;
  assert.equal(Math.sign(m), Math.sign(best.wr - 0.5), JSON.stringify(best));
});

test('ARAM Mayhem: every real game gets a keep-or-swap advice over my champion and the bench', () => {
  const aram = readdirSync(dir).filter((f) => f.startsWith('q2400')).map((f) => read(`./fixtures/real/${f}`));
  let swaps = 0;
  for (const g of aram) {
    const draft = draftState(g.events.at(-1).session);
    const advice = recommend(draft, { stats, profile, champions, info });
    const me = draft.allies.find((p) => p.me);
    const allowed = new Set([me.championId, ...draft.bench]);
    assert.ok(advice.options.length >= 1);
    for (const o of advice.options) assert.ok(allowed.has(o.championId), 'only my champion or the bench');
    if (advice.verb === 'Prends sur le banc') {
      swaps++;
      assert.notEqual(advice.options[0].championId, me.championId);
    } else {
      assert.equal(advice.options[0].championId, me.championId);
    }
  }
  assert.ok(swaps > 0, 'some games suggest a swap');
});

test('ARAM: a personal record on a champion moves it, shrunk towards neutral', () => {
  const g = read('./fixtures/real/q2400-2026-10-25-50.json');
  const draft = draftState(g.events.at(-1).session);
  const benchId = draft.bench[0];
  const strong = { champions: { [benchId]: { byQueue: { 2400: { games: 20, wins: 16 } } } } };
  const advice = recommend(draft, { stats, profile: strong, champions, info });
  const o = advice.options.find((x) => x.championId === benchId);
  const pts = o.reasons.find((r) => r.label === 'Ton bilan').delta * 100;
  assert.ok(pts > 2 && pts < 6, `16/20 should be worth a few points, not 30: ${pts}`);
});
