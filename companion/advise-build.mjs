// In-game build advice from the Live Client Data API: what to buy with your gold now, the usual
// build for your champion at your rank, and the items their team calls for. Only what the
// scoreboard shows; several options, the player decides (like the shop's own suggestions).
// The build follows what you started: AP items on Galio switch to the AP build of that champion.

const POSITIONS = { TOP: 0, JUNGLE: 1, MIDDLE: 2, BOTTOM: 3, UTILITY: 4 };

// Champions known for heavy healing or lifesteal: anti-heal pays against them.
const HEALERS = new Set([
  'Soraka', 'Yuumi', 'Sona', 'Nami', 'Milio', 'Taric', 'Senna', 'Aatrox', 'Vladimir', 'DrMundo', 'Warwick', 'Sylas',
  'Swain', 'Fiddlesticks', 'Briar', 'Illaoi', 'Olaf', 'Gwen', 'Maokai', 'Volibear', 'Trundle', 'Nasus', 'Samira', 'Udyr', 'Zac',
]);

// Item choices by need and by the kind of champion you play.
const ADAPT = {
  antiHeal: { tank: 3075, ap: 3165, marksman: 3033, ad: 6609, support: 3916 },
  armor: { tank: 3143, ap: 3157, marksman: 3026, ad: 6333, support: 3190 },
  magicResist: { tank: 4401, ap: 3102, marksman: 3156, ad: 3156, support: 3222 },
  penetration: { tank: null, ap: 3135, marksman: 3036, ad: 6694, support: null },
  crit: { tank: 3143, ap: null, marksman: null, ad: 3143, support: null },
  attackSpeed: { tank: 3110, ap: null, marksman: null, ad: 3091, support: null },
  boots: { armor: 3047, magicResist: 3111 },
};
const MIN_SLOT_GAMES = 300; // below this, an alternative's winrate is noise
const MIN_VARIANT_GAMES = 20; // a variant played less than this is not a build yet
const COMPLETED = 2000; // cost from which an item counts as finished (components cost less)
const STYLE_NAMES = { ap: 'AP', tank: 'tank', ad: 'AD' };

// What an item is for: ability power, attack damage or durability.
export function itemStyle(item) {
  const tags = item?.tags ?? [];
  if (tags.includes('SpellDamage')) return 'ap';
  if (['Damage', 'CriticalStrike', 'AttackSpeed'].some((t) => tags.includes(t))) return 'ad';
  if (['Health', 'Armor', 'SpellBlock'].some((t) => tags.includes(t))) return 'tank';
  return null;
}
const isBoots = (item) => Boolean(item?.tags?.includes('Boots'));
// The support quest line (World Atlas and what it becomes) is one slot, earned, never bought.
const isSupportQuest = (id) => id >= 3865 && id <= 3877;
// ARAM modes sell their own copies of some items (126697 for 6697): read them as the original.
const baseItem = (id, items) => (id >= 120000 && id < 130000 && items[id - 120000] ? id - 120000 : id);

// The style a set of items leans to: finished items count fully, big components a little.
function leaning(ids, items, minWeight) {
  const score = {};
  for (const id of ids) {
    const item = items[id];
    if (!item || isBoots(item)) continue;
    const weight = item.cost >= COMPLETED ? 1 : item.cost >= 700 ? 0.4 : 0;
    const style = weight ? itemStyle(item) : null;
    if (style) score[style] = (score[style] ?? 0) + weight;
  }
  const [best] = Object.entries(score).sort((a, b) => b[1] - a[1]);
  return best && best[1] >= minWeight ? best[0] : null;
}

// The most played build, unless the player started another style that u.gg also tracks.
function pickBuild(builds, started, items) {
  const usable = Object.entries(builds ?? {}).filter(([, b]) => b?.core?.items?.length && (b.core.games ?? 0) >= MIN_VARIANT_GAMES);
  const main = builds?.default ?? usable[0]?.[1] ?? null;
  if (!started) return { build: main, followed: false };
  const [fit] = usable
    .filter(([, b]) => leaning(b.core.items, items, 1) === started)
    .sort((a, b) => Number(b[0] === 'default') - Number(a[0] === 'default') || b[1].core.games - a[1].core.games);
  return fit ? { build: fit[1], followed: fit[1] !== main } : { build: main, followed: false, missing: true };
}

const normal = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

export function championKeyOf(player, info) {
  const raw = normal(String(player.rawChampionName ?? '').replace('game_character_displayname_', ''));
  const display = normal(player.championName);
  for (const [key, c] of Object.entries(info)) {
    if (normal(c.id) === raw || normal(c.name) === display) return key;
  }
  return null;
}

export function adviseBuild(live, { build: only, builds = { default: only }, items, info, physOf = () => null }) {
  const players = (live?.allPlayers ?? []).map((p) => ({ ...p, items: (p.items ?? []).map((i) => ({ ...i, itemID: baseItem(i.itemID, items) })) }));
  // Spectating has no active player: nothing to advise.
  const meId = live?.activePlayer?.riotId ?? live?.activePlayer?.summonerName;
  const me = meId ? players.find((p) => p.riotId === meId || p.summonerName === meId) : null;
  if (!me) return null;
  const key = championKeyOf(me, info);
  const gold = Math.floor(live.activePlayer?.currentGold ?? 0);
  const ownedIds = (me.items ?? []).map((i) => i.itemID);
  const owned = new Set(ownedIds);
  const enemies = players.filter((p) => p.team !== me.team);
  const role = (p) => POSITIONS[p.position];

  // The style you started (two finished items, or one and a big component), and the build for it.
  const started = leaning(ownedIds, items, 1.4);
  const { build, followed, missing } = pickBuild(builds, started, items);

  // What kind of champion you are, for picking the right variant of an item.
  const myTags = info[key]?.tags ?? [];
  const myPhys = physOf(key, role(me));
  let kind = myTags.includes('Tank')
    ? 'tank'
    : me.position === 'UTILITY'
      ? 'support'
      : myTags.includes('Marksman')
        ? 'marksman'
        : (myPhys ?? (myTags.includes('Mage') ? 0.2 : 0.8)) >= 0.5 ? 'ad' : 'ap';
  if (started && kind !== 'support') kind = started === 'ad' ? (myTags.includes('Marksman') ? 'marksman' : 'ad') : started;

  // Their team, as the scoreboard shows it: champions, and the items they actually bought.
  const enemyKeys = enemies.map((p) => championKeyOf(p, info)).filter(Boolean);
  const phys = enemies.map((p) => physOf(championKeyOf(p, info), role(p))).filter((x) => x != null);
  const physical = phys.length ? phys.reduce((a, b) => a + b, 0) / phys.length : null;
  const healers = enemyKeys.filter((k) => HEALERS.has(info[k]?.id));
  const tanks = enemyKeys.filter((k) => (info[k]?.attrs?.durability ?? 0) >= 3 || (info[k]?.tags ?? []).includes('Tank')).length;
  const cc = enemyKeys.reduce((s, k) => s + (info[k]?.attrs?.cc ?? 0), 0);
  // Finished items only: a single Zeal or Berserker's Greaves says little about a team.
  const theirItems = enemies.flatMap((p) => (p.items ?? []).map((i) => i.itemID)).filter((id) => items[id] && items[id].cost >= COMPLETED && !isBoots(items[id]));
  const withTag = (...tags) => theirItems.filter((id) => tags.some((t) => items[id].tags.includes(t))).length;
  const signals = {
    crit: withTag('CriticalStrike'),
    attackSpeed: withTag('AttackSpeed'),
    lifesteal: withTag('LifeSteal', 'SpellVamp'),
    armor: withTag('Armor'),
    magicResist: withTag('SpellBlock', 'MagicResist'),
  };

  // The enemy running away with the game: the most item value (gold is not shown for others).
  const valued = enemies.map((p) => ({
    p,
    key: championKeyOf(p, info),
    value: (p.items ?? []).reduce((sum, i) => sum + (items[i.itemID]?.cost ?? 0), 0),
  }));
  const average = valued.reduce((sum, v) => sum + v.value, 0) / Math.max(1, valued.length);
  const top = [...valued].sort((a, b) => b.value - a.value)[0];
  const threat = top && top.key && top.value >= 3500 && top.value >= 1.4 * average
    ? { championId: Number(top.key), value: top.value, kda: top.p.scores ? `${top.p.scores.kills}/${top.p.scores.deaths}/${top.p.scores.assists}` : '', physical: physOf(top.key, role(top.p)) }
    : null;

  // The usual path: core items, then the most played option for each of the next slots.
  const usual = [...(build?.core?.items ?? [])];
  const slotOf = {};
  (build?.slots ?? []).forEach((slot, i) => {
    const pick = [...slot].sort((a, b) => b.games - a.games).find((o) => !usual.includes(o.item));
    if (pick) {
      usual.push(pick.item);
      slotOf[pick.item] = i;
    }
  });
  // Your own items come first: any finished boots stand for the build's boots, and finished
  // items outside this build still take a slot.
  const ownedBoots = ownedIds.find((id) => isBoots(items[id]) && items[id].cost > 300);
  const ownedQuest = ownedIds.find(isSupportQuest);
  const plan = [];
  for (const id of usual) {
    if (!items[id]) continue;
    const slotItem = isBoots(items[id]) && ownedBoots ? ownedBoots : isSupportQuest(id) ? ownedQuest ?? id : id;
    if (!plan.includes(slotItem)) plan.push(slotItem);
  }
  const extras = ownedIds.filter((id) => items[id] && items[id].cost >= COMPLETED && !isBoots(items[id]) && !isSupportQuest(id) && !plan.includes(id));
  const todo = plan.filter((id) => !owned.has(id) && !isSupportQuest(id));
  // Next: finish basic boots once an item is done, else the first two items of the path,
  // the one you already hold parts of first.
  const parts = (id) => (items[id]?.from ?? []).flatMap((c) => [c, ...parts(c)]);
  const held = (id) => [...new Set(parts(id))].filter((c) => owned.has(c)).reduce((s, c) => s + (items[c]?.cost ?? 0), 0);
  const basicBoots = ownedIds.some((id) => isBoots(items[id]) && items[id].cost <= 300);
  const finished = ownedIds.filter((id) => items[id]?.cost >= COMPLETED).length;
  const bootsTodo = todo.find((id) => isBoots(items[id]));
  const next = basicBoots && finished && bootsTodo
    ? bootsTodo
    : todo.slice(0, 2).sort((a, b) => held(b) - held(a))[0];
  const path = [...plan.filter((id) => owned.has(id)), ...extras, ...(next ? [next] : []), ...todo.filter((id) => id !== next)]
    .slice(0, Math.max(6, owned.size));

  // Items their team calls for, strongest reason first.
  const adapt = [];
  const add = (id, reason, weight) => {
    if (id && items[id]?.buyable && !owned.has(id) && id !== next && !adapt.some((a) => a.item === id)) adapt.push({ item: id, reason, weight });
  };
  if (healers.length || signals.lifesteal >= 2) {
    const names = healers.map((k) => info[k]?.name).slice(0, 2).join(', ');
    add(ADAPT.antiHeal[kind], names ? `Contre leurs soins (${names})` : `Contre leur vol de vie (${signals.lifesteal} items)`, 2 + healers.length);
  }
  if (signals.crit >= 3) add(ADAPT.crit[kind], `${signals.crit} items à critiques en face`, 1 + signals.crit);
  if (signals.attackSpeed >= 3) add(ADAPT.attackSpeed[kind], `${signals.attackSpeed} items de vitesse d'attaque en face`, signals.attackSpeed);
  if (threat) {
    const name = info[String(threat.championId)]?.name ?? '';
    const variant = threat.physical != null && threat.physical < 0.5 ? ADAPT.magicResist[kind] : ADAPT.armor[kind];
    add(variant, `${name} s'envole (${threat.value.toLocaleString('fr-FR')} po d'items${threat.kda ? `, ${threat.kda}` : ''})`, 4);
  }
  if (physical != null && physical >= 0.65) add(ADAPT.armor[kind], `Ils sont très AD (${Math.round(physical * 100)} %)`, 2);
  if (physical != null && physical <= 0.4) add(ADAPT.magicResist[kind], `Ils sont très AP (${Math.round((1 - physical) * 100)} %)`, 2);
  if (tanks >= 2 || signals.armor >= 4) add(ADAPT.penetration[kind], signals.armor >= 4 ? `Ils empilent l'armure (${signals.armor} items)` : `${tanks} tanks en face`, 2);
  if (kind === 'ap' && signals.magicResist >= 4) add(ADAPT.penetration.ap, `Ils empilent la résistance magique (${signals.magicResist} items)`, 2);
  if (!ownedBoots) {
    const ad = physical ?? 0.5;
    if (ad >= 0.6 || (signals.crit + signals.attackSpeed >= 4 && ad >= 0.45)) add(ADAPT.boots.armor, 'Bottes contre leurs attaques', 1);
    else if (ad <= 0.4 || cc >= 11) add(ADAPT.boots.magicResist, ad <= 0.4 ? 'Bottes contre leurs dégâts magiques' : 'Beaucoup de contrôle en face', 1);
  }
  adapt.sort((a, b) => b.weight - a.weight);

  // Alternatives for the next item: the other choices players make at that slot, with their
  // winrate when the sample is big enough, then the strongest item their team calls for.
  const slot = next != null && slotOf[next] != null ? build.slots[slotOf[next]] : null;
  const alternatives = (slot ?? [])
    .filter((o) => o.item !== next && !owned.has(o.item) && items[o.item] && o.games >= MIN_SLOT_GAMES)
    .sort((a, b) => b.games - a.games)
    .slice(0, 2)
    .map((o) => ({ item: o.item, winrate: o.wins / o.games, games: o.games }));
  // Boots next: the other boots their team calls for; else the strongest item it calls for.
  const rival = isBoots(items[next]) ? adapt.find((a) => isBoots(items[a.item])) : adapt.find((a) => !isBoots(items[a.item]));
  if (rival) alternatives.unshift({ item: rival.item, reason: rival.reason });
  const nextStats = slot?.find((o) => o.item === next);

  return {
    championId: Number(key),
    gold,
    gameTime: Math.round(live.gameData?.gameTime ?? 0),
    gameMode: live.gameData?.gameMode ?? '',
    buy: purchase(next, gold, owned, items),
    nextStats: nextStats && nextStats.games >= MIN_SLOT_GAMES ? { winrate: nextStats.wins / nextStats.games, games: nextStats.games } : null,
    alternatives: alternatives.slice(0, 3),
    path: path.map((id) => ({ item: id, owned: owned.has(id) })),
    noBuild: !build,
    style: started || build?.variant
      ? { started: started ?? null, name: STYLE_NAMES[started] ?? null, followed, missing: Boolean(missing), variant: build?.variant ?? 'default' }
      : null,
    adapt: adapt.slice(0, 3).map(({ item, reason }) => ({ item, reason })),
    enemy: { physical, healers: healers.map(Number), tanks, cc, signals, threat },
    skills: build?.skills ? { priority: build.skills.priority, start: build.skills.order.slice(0, 3) } : null,
    source: build ? { games: build.core.games, wins: build.core.wins, queue: build.queue, patch: build.patch, variant: build.variant ?? 'default' } : null,
  };
}

// The next item if you can afford it, else the most expensive part of it you can buy now.
function purchase(next, gold, owned, items) {
  if (!next) return null;
  const item = items[next];
  const parts = (id) => (items[id]?.from ?? []).flatMap((c) => [c, ...parts(c)]);
  const ownedParts = (items[next].from ?? []).filter((c) => owned.has(c));
  const missing = item.cost - ownedParts.reduce((s, c) => s + (items[c]?.cost ?? 0), 0);
  if (gold >= missing) return { item: next, for: next, cost: missing, text: `Achète ${item.name}` };
  const affordable = parts(next).filter((c) => !owned.has(c) && items[c] && items[c].cost <= gold).sort((a, b) => items[b].cost - items[a].cost)[0];
  if (affordable) return { item: affordable, for: next, cost: items[affordable].cost, text: `Achète ${items[affordable].name}, vers ${item.name}` };
  return { item: next, for: next, cost: missing, short: missing - gold, text: `Il te manque ${missing - gold} po pour ${item.name}` };
}
