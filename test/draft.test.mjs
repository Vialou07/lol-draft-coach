import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { draftState } from '../companion/draft.mjs';

const dir = new URL('./fixtures/real/', import.meta.url);
const games = readdirSync(dir).map((f) => ({ file: f, ...JSON.parse(readFileSync(new URL(f, dir), 'utf8')) }));

test('every real champ select from the client logs decodes without error', () => {
  assert.ok(games.length > 0);
  for (const g of games) for (const e of g.events) draftState(e.session);
});

test('mode detection: ranked queues are drafts, ARAM Mayhem (2400) is a bench mode', () => {
  for (const g of games) {
    const kind = draftState(g.events.at(-1).session).kind;
    if (g.queueId === 420 || g.queueId === 440) assert.equal(kind, 'draft', g.file);
    if (g.queueId === 2400) assert.equal(kind, 'aram', g.file);
  }
});

test('an enemy champion is never exposed before the enemy locks it', () => {
  for (const g of games.filter((g) => g.queueId === 420 || g.queueId === 440)) {
    for (const { session } of g.events) {
      const state = draftState(session);
      const unlocked = (session.actions ?? []).flat().filter((a) => a.type === 'pick' && !a.isAllyAction && !a.completed);
      for (const a of unlocked) {
        const shown = state.enemies.find((p) => p.cellId === a.actorCellId);
        assert.equal(shown?.championId ?? 0, 0, `${g.file}: enemy cell ${a.actorCellId} leaked`);
      }
    }
  }
});

test('a ranked game ends with 5 locked allies, 5 locked enemies and 10 bans', () => {
  const g = games.find((g) => g.queueId === 420);
  const last = draftState(g.events.at(-1).session);
  assert.equal(last.allies.filter((p) => p.championId > 0).length, 5);
  assert.equal(last.enemies.filter((p) => p.championId > 0).length, 5);
  assert.equal(last.bans.ally.length + last.bans.enemy.length, 10);
  assert.equal(last.allies.filter((p) => p.me).length, 1);
  assert.ok(last.allies.every((p) => p.role), 'every ally has a role in ranked');
});

test('ARAM Mayhem: my champion and the bench are read, enemies stay hidden', () => {
  for (const g of games.filter((g) => g.queueId === 2400)) {
    const last = draftState(g.events.at(-1).session);
    const me = last.allies.find((p) => p.me);
    assert.ok(me && me.championId > 0, `${g.file}: my champion`);
    assert.ok(last.enemies.every((p) => p.championId === 0), `${g.file}: enemies hidden`);
  }
  const withBench = games.filter((g) => g.queueId === 2400 && draftState(g.events.at(-1).session).bench.length > 0);
  assert.ok(withBench.length > games.filter((g) => g.queueId === 2400).length / 2, 'most ARAM games have a bench');
});

test('my turn is detected during a ranked pick', () => {
  const g = games.find((g) => g.queueId === 420);
  const turns = g.events.map((e) => draftState(e.session).myTurn).filter(Boolean);
  assert.ok(turns.includes('ban') && turns.includes('pick'), `turns seen: ${[...new Set(turns)]}`);
});
