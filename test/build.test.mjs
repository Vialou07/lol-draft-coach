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

test('a tank facing a crit-heavy team gets Randuin, from the items they actually bought', () => {
  const crits = Object.entries(items).filter(([, it]) => it.buyable && it.tags.includes('CriticalStrike') && it.cost >= 2500).map(([id]) => Number(id)).slice(0, 4);
  const game = structuredClone(live);
  const me = game.allPlayers[4];
  Object.assign(me, { championName: 'Leona', rawChampionName: 'game_character_displayname_Leona' });
  game.allPlayers[8].items = crits.slice(0, 2).map((itemID) => ({ itemID }));
  game.allPlayers[7].items = crits.slice(2, 4).map((itemID) => ({ itemID }));
  const a = adviseBuild(game, { build, items, info, physOf });
  assert.ok(a.enemy.signals.crit >= 3, `crit items seen: ${a.enemy.signals.crit}`);
  const randuin = a.adapt.find((x) => x.item === 3143);
  assert.ok(randuin, `Randuin suggested: ${JSON.stringify(a.adapt)}`);
  assert.match(randuin.reason, /critiques/);
});

test('the enemy running away with the game is spotted by item value, with a counter to their damage', () => {
  const game = structuredClone(live);
  game.allPlayers[8].items = [3031, 3033, 3036, 3046].filter((id) => items[id]).map((itemID) => ({ itemID })); // Miss Fortune
  game.allPlayers[8].scores = { kills: 9, deaths: 1, assists: 3 };
  const a = adviseBuild(game, { build, items, info, physOf });
  assert.equal(a.enemy.threat?.championId, 21);
  assert.ok(a.adapt.some((x) => /s'envole/.test(x.reason)), JSON.stringify(a.adapt));
});

test('alternatives: other choices at that slot with enough games, and the strongest adaptation first', () => {
  const rich = structuredClone(live);
  rich.allPlayers[4].items = [3870, 6620, 3158].map((itemID) => ({ itemID })); // core done: next is slot 4
  const a = adviseBuild(rich, { build, items, info, physOf });
  assert.ok(a.alternatives.length >= 2);
  assert.ok(a.alternatives[0].reason, 'first alternative answers their team');
  for (const alt of a.alternatives.slice(1)) assert.ok(alt.games >= 300 && alt.winrate > 0.3 && alt.winrate < 0.7);
});

test('the build follows what you started: AP Galio gets the AP build, not the tank one', () => {
  const game = read('./fixtures/live-galio-ap.json'); // a real ARAM Mayhem game: Luden and Shadowflame on Galio
  const builds = read('./fixtures/build-galio-aram.json');
  const a = adviseBuild(game, { builds, items, info, physOf });
  assert.equal(a.style.started, 'ap');
  assert.equal(a.source.variant, 'ap', 'AP variant of u.gg');
  assert.deepEqual(a.path.slice(0, 2).map((p) => p.owned), [true, true], 'your own items first');
  assert.ok(a.path.slice(2).every((p) => !p.owned && items[p.item].tags.includes('SpellDamage') || items[p.item].tags.includes('Boots')), 'only AP items and boots next');
  assert.equal(a.buy.for, 3020, 'basic boots and two items done: finish the boots (Sorcerer)');
  assert.ok(!a.path.some((p) => p.item === 3084), 'no Heartsteel');
  const fresh = structuredClone(game);
  fresh.allPlayers[9].items = [];
  assert.equal(adviseBuild(fresh, { builds, items, info, physOf }).source.variant, 'default', 'nothing bought yet: the most played build');
});
