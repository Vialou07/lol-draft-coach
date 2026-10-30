// In-game build advice from a Live Client Data payload (format of Riot's official API).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adviseBuild, championKeyOf } from '../companion/advise-build.mjs';
import { championInfo } from '../companion/static-data.mjs';
import { compactBuild } from '../companion/stats-builds.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const info = championInfo(read('./fixtures/ddragon-champions.json'));
const items = read('./fixtures/items.json');
const build = read('./fixtures/build-nami-support.json');
const live = read('./fixtures/live-sample.json');
const physOf = (key) => ({ 266: 0.9, 517: 0.3, 777: 0.95, 21: 0.9, 80: 0.85 })[key] ?? 0.5;

test('players are matched to champions from the game names', () => {
  assert.equal(championKeyOf(live.allPlayers[4], info), '267');
  assert.equal(championKeyOf(live.allPlayers[8], info), '21'); // MissFortune
});

test('what to buy with the gold you have: the next item, else its most expensive part you can afford', () => {
  const a = adviseBuild(live, { build, items, info, physOf });
  assert.equal(a.gold, 1180);
  assert.ok(a.path[0].owned, 'first core item already bought');
  assert.equal(a.buy.for, a.path.find((p) => !p.owned).item);
  assert.ok(a.buy.cost <= a.gold, 'something you can buy now');
  const rich = adviseBuild({ ...live, activePlayer: { ...live.activePlayer, currentGold: 5000 } }, { build, items, info, physOf });
  assert.equal(rich.buy.item, rich.buy.for, 'enough gold: the full item');
  const poor = adviseBuild({ ...live, activePlayer: { ...live.activePlayer, currentGold: 50 } }, { build, items, info, physOf });
  assert.ok(poor.buy.short > 0, 'says how much is missing');
});

test('the enemy team calls for anti-heal and armour, in the support variant for a support', () => {
  const a = adviseBuild(live, { build, items, info, physOf });
  assert.deepEqual(a.enemy.healers.sort(), [266, 517].sort(), 'Aatrox and Sylas heal');
  const reasons = a.adapt.map((x) => x.reason).join(' | ');
  assert.match(reasons, /soins/);
  assert.ok(a.adapt.some((x) => x.item === 3916), 'support anti-heal: Oblivion Orb');
  for (const x of a.adapt) assert.ok(items[x.item].buyable && !a.path.some((p) => p.item === x.item));
  assert.ok(a.adapt.length <= 3);
});

test('u.gg overview layout: core, skills and next-slot options are read', () => {
  const raw = { 12: { 10: { 2: [[[100, 55, 8200, 8400, [1, 2]], [90, 50, [4, 14]], [80, 40, [1056]], [70, 39, [3870, 6620, 3158]], [60, 33, ['W', 'E', 'Q'], 'WEQ'], [[[3504, 10, 20]]], [50, 100]]] } } };
  const b = compactBuild(raw, { rank: '10', role: '2' });
  assert.deepEqual(b.core.items, [3870, 6620, 3158]);
  assert.equal(b.skills.priority, 'WEQ');
  assert.deepEqual(b.slots[0][0], { item: 3504, wins: 10, games: 20 });
  assert.equal(b.games, 100);
});
