import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactElo, TIER_SLUGS } from '../companion/stats-elo.mjs';
import { isEngage, isPeel, isFrontline } from '../companion/static-attrs.mjs';
import { createDraftModel } from '../companion/model-draft.mjs';
import { readFileSync } from 'node:fs';

test('u.gg tier list: wins and games read per role, role winrates centred', () => {
  const raw = { 0: { adc: [['222', [], 51, 100], ['22', [], 49, 100]], supp: [['267', [], 30, 50]], top: [], mid: [], jungle: [] } };
  const elo = compactElo(raw, 'gold', '16_21');
  assert.deepEqual(elo.champs['222'][3], [100, 51]);
  assert.deepEqual(elo.champs['267'][4], [50, 30]);
  assert.equal(elo.roleWinrate[3], 0.5);
  assert.equal(TIER_SLUGS.GRANDMASTER, 'master_plus');
});

test('meta at your elo: a champion strong in your bracket moves up, shrunk when it has few games', () => {
  const stats = JSON.parse(readFileSync(new URL('./fixtures/draft-stats-mini.json', import.meta.url), 'utf8'));
  const base = createDraftModel(stats).meta('222', 3).value;
  const strong = { roleWinrate: [0.5, 0.5, 0.5, 0.5, 0.5], champs: { 222: [[0, 0], [0, 0], [0, 0], [200000, 110000], [0, 0]] } };
  const few = { roleWinrate: [0.5, 0.5, 0.5, 0.5, 0.5], champs: { 222: [[0, 0], [0, 0], [0, 0], [30, 30], [0, 0]] } };
  const withStrong = createDraftModel(stats, { elo: strong }).meta('222', 3).value;
  const withFew = createDraftModel(stats, { elo: few }).meta('222', 3).value;
  assert.ok(withStrong > base + 0.1, '55 % over 200k games counts');
  assert.ok(Math.abs(withFew - base) < 0.05, '30 games barely move it');
});

test('engage, peel and frontline read from the client tags and ratings', () => {
  const leona = { cc: 3, durability: 3, utility: 1, tags: ['Initiator', 'Crowd Control'] };
  const janna = { cc: 3, durability: 1, utility: 3, tags: ['Crowd Control', 'Ally Protection'] };
  const jinx = { cc: 2, durability: 1, utility: 1, tags: ['Auto-attack', 'Hypercarry'] };
  assert.ok(isEngage(leona) && !isEngage(janna) && !isEngage(jinx));
  assert.ok(isPeel(janna) && !isPeel(jinx));
  assert.ok(isFrontline(leona) && !isFrontline(janna));
});
