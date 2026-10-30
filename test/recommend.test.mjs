import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { draftState } from '../companion/draft.mjs';
import { recommend } from '../companion/recommend.mjs';
import { createDraftModel } from '../companion/model-draft.mjs';
import { championInfo } from '../companion/static-data.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const stats = { draft: read('./fixtures/draft-stats-mini.json'), mayhem: read('./fixtures/mayhem-stats.json') };
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
        assert.ok(advice.options.length >= 3, 'Riot rules: always several options');
        assert.ok(advice.reference, 'gap measured against a reference champion');
        for (const o of advice.options) assert.ok(o.reasons.length <= 2, 'two reasons at most');
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
    assert.equal(advice.verb, 'Ton ban');
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
    assert.equal(advice.current.championId, me.championId, 'my champion is the reference');
    assert.ok(advice.options.some((o) => o.mine && o.championId === me.championId), 'my champion is in the list');
    for (const o of advice.options) if (!o.mine) assert.ok(draft.bench.includes(o.championId), 'the others come from the bench');
    assert.equal(advice.options[0].championId, advice.focus, 'the advice comes first');
    if (advice.verb === 'Prends') {
      swaps++;
      assert.ok(advice.options[0].delta >= 0.01, 'a swap is worth at least a point');
    } else {
      assert.equal(advice.focus, me.championId);
      assert.ok(advice.options.every((o) => o.delta < 0.01), 'nothing on the bench beats my champion');
    }
  }
  assert.ok(swaps > 0, 'some games suggest a swap');
});

test('ARAM: the number is the mode winrate as published, a personal record does not move it', () => {
  const g = read('./fixtures/real/q2400-2026-10-25-50.json');
  const draft = draftState(g.events.at(-1).session);
  const benchId = draft.bench[0];
  const record = { champions: { [benchId]: { byQueue: { 2400: { games: 3, wins: 0 } } } } };
  for (const profile of [{}, record]) {
    const advice = recommend(draft, { stats, profile, champions, info });
    for (const o of advice.options) {
      const wr = stats.mayhem.champs[o.championId]?.wr;
      if (wr) assert.ok(Math.abs(o.p - wr) < 1e-9, `${o.championId}: ${o.p} shown for ${wr}`);
      assert.equal(o.tier, undefined, 'no tier next to the winrate');
    }
  }
});

test('ARAM: tonight’s Galio select, a bench champion less than a point better is not worth a swap', () => {
  const g = read('./fixtures/real/q2400-2026-10-30-75.json');
  const draft = draftState(g.events[12].session); // Galio after a trade, Poppy (+0.8) on the bench
  const advice = recommend(draft, { stats, profile: {}, champions, info });
  assert.equal(advice.verb, 'Garde');
  assert.equal(advice.focus, 3);
  assert.equal(advice.options[0].championId, 3, 'the advice comes first');
  const early = recommend(draftState(g.events[10].session), { stats, profile: {}, champions, info });
  assert.equal(early.verb, 'Prends', 'Ekko back on the bench is worth the swap');
  assert.equal(early.focus, 245);
});

test('ARAM Mayhem: with mode winrates, a much stronger bench champion is advised, an unowned one is not', () => {
  const byWr = Object.entries(stats.mayhem.champs).sort((a, b) => a[1].wr - b[1].wr);
  const [weak] = byWr[0];
  const [strong] = byWr.at(-1);
  const [second] = byWr.at(-2);
  const draft = {
    kind: 'aram', queueId: 2400, phase: 'BAN_PICK', bans: { ally: [], enemy: [] }, enemies: [],
    allies: [{ cellId: 0, me: true, role: '', championId: Number(weak), hoverId: 0 }],
    bench: [Number(strong), Number(second)], allyBanHovers: [],
  };
  const advice = recommend(draft, { stats, profile: {}, champions, info });
  assert.equal(advice.verb, 'Prends');
  assert.equal(advice.options[0].championId, Number(strong));
  assert.ok(Math.abs(advice.options[0].p - stats.mayhem.champs[strong].wr) < 1e-9, 'the number is the mode winrate');
  assert.ok(advice.options.some((o) => o.mine && o.championId === Number(weak)), 'my champion stays shown for comparison');
  const notOwned = recommend(draft, { stats, profile: {}, champions, info, owned: [Number(weak), Number(second)] });
  assert.equal(notOwned.options[0].championId, Number(second), 'unowned bench champion skipped');
  assert.ok(!notOwned.options.some((o) => o.championId === Number(strong)));
});

test('ARAM: an ownership list that would hide the whole bench is ignored', () => {
  const g = read('./fixtures/real/q2400-2026-10-25-50.json');
  const draft = draftState(g.events.at(-1).session);
  const me = draft.allies.find((p) => p.me);
  const advice = recommend(draft, { stats, profile: {}, champions, info, owned: [me.championId] });
  assert.ok(advice.options.length > 0, 'bench still shown');
});

test('draft analysis: lane opponent, both teams and game length are read around my champion', () => {
  const g = ranked.find((x) => x.file === 'q420-2026-10-24-03.json');
  const { advice } = advise(g.events.at(-1).session);
  const an = advice.analysis;
  assert.ok(an, 'analysis present after lock');
  assert.ok(an.lane.opponentId > 0, 'lane opponent identified once enemies are locked');
  assert.equal(an.teams.us.size, 5);
  assert.equal(an.teams.them.size, 5);
  assert.ok(an.teams.us.physical > 0 && an.teams.us.physical < 1);
  assert.equal(an.timing.length, 3);
  assert.ok(an.overall.low <= an.overall.p && an.overall.p <= an.overall.high);
});

test('ARAM team: the shared bench is split, never the same champion for two players', async () => {
  const { assignBench } = await import('../companion/team.mjs');
  for (const f of readdirSync(dir).filter((f) => f.startsWith('q2400')).slice(0, 25)) {
    const g = read(`./fixtures/real/${f}`);
    const session = g.events.find((e) => e.session.timer.phase === 'FINALIZATION')?.session ?? g.events.at(-1).session;
    const views = session.myTeam.map((p) => {
      const draft = draftState({ ...session, localPlayerCellId: p.cellId });
      return { name: p.anonName, draft, advice: recommend(draft, { stats, profile: { unknown: true }, champions, info }) };
    });
    const assigned = assignBench(views).map((v) => v.advice?.assigned).filter(Boolean);
    assert.equal(new Set(assigned).size, assigned.length, `${f}: a bench champion given twice`);
  }
});

test('ARAM team: the PC owner keeps their best bench choice, never marked as for someone else', async () => {
  const { assignBench } = await import('../companion/team.mjs');
  for (const f of readdirSync(dir).filter((f) => f.startsWith('q2400')).slice(0, 25)) {
    const g = read(`./fixtures/real/${f}`);
    const session = g.events.find((e) => e.session.timer.phase === 'FINALIZATION')?.session ?? g.events.at(-1).session;
    const views = session.myTeam.map((p) => {
      const draft = draftState({ ...session, localPlayerCellId: p.cellId });
      return { name: p.anonName, self: p.cellId === session.localPlayerCellId, draft, advice: recommend(draft, { stats, profile: { unknown: true }, champions, info }) };
    });
    const own = views.find((v) => v.self);
    if (!own?.advice?.options) continue;
    const mine = assignBench(views).find((v) => v.self).advice;
    assert.equal(mine.focus, own.advice.focus, `${f}: own advice unchanged`);
    assert.ok(mine.options.every((o) => !o.takenBy), `${f}: nothing marked for an ally`);
  }
});

test('traps and champions to learn come with a reason, and never an ally’s hover', () => {
  const g = ranked.find((x) => x.file === 'q420-2026-10-24-03.json');
  const session = g.events[32].session;
  const draft = draftState(session);
  const advice = recommend(draft, { stats, profile, champions, info, learning: [89, 497, 25] });
  const hovers = draft.allies.filter((p) => !p.me && p.hoverId).map((p) => p.hoverId);
  for (const o of [...advice.options, ...advice.avoid]) assert.ok(!hovers.includes(o.championId), 'ally hover suggested');
  for (const t of advice.avoid) assert.ok(t.reason && t.reason !== 'Confort', 'a trap is about this draft');
  assert.equal(advice.learn.length, 3);
  for (const l of advice.learn) assert.ok(['go', 'maybe', 'no', 'offrole'].includes(l.verdict) && l.text);
});
