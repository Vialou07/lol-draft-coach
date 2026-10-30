// In-game build advice from the Live Client Data API: what to buy with your gold now, the usual
// build for your champion at your rank, and the items their team calls for. Only what the
// scoreboard shows; several options, the player decides (like the shop's own suggestions).

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

const normal = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

export function championKeyOf(player, info) {
  const raw = normal(String(player.rawChampionName ?? '').replace('game_character_displayname_', ''));
  const display = normal(player.championName);
  for (const [key, c] of Object.entries(info)) {
    if (normal(c.id) === raw || normal(c.name) === display) return key;
  }
  return null;
}

export function adviseBuild(live, { build, items, info, physOf = () => null }) {
  const players = live?.allPlayers ?? [];
  const meId = live?.activePlayer?.riotId ?? live?.activePlayer?.summonerName;
  const me = players.find((p) => p.riotId === meId || p.summonerName === meId) ?? players[0];
  if (!me) return null;
  const key = championKeyOf(me, info);
  const gold = Math.floor(live.activePlayer?.currentGold ?? 0);
  const owned = new Set((me.items ?? []).map((i) => i.itemID));
  const enemies = players.filter((p) => p.team !== me.team);
  const role = (p) => POSITIONS[p.position];

  // What kind of champion you are, for picking the right variant of an item.
  const myTags = info[key]?.tags ?? [];
  const myPhys = physOf(key, role(me));
  const kind = myTags.includes('Tank')
    ? 'tank'
    : me.position === 'UTILITY'
      ? 'support'
      : myTags.includes('Marksman')
        ? 'marksman'
        : (myPhys ?? (myTags.includes('Mage') ? 0.2 : 0.8)) >= 0.5 ? 'ad' : 'ap';

  // Their team, as the scoreboard shows it: champions, and the items they actually bought.
  const enemyKeys = enemies.map((p) => championKeyOf(p, info)).filter(Boolean);
  const phys = enemies.map((p) => physOf(championKeyOf(p, info), role(p))).filter((x) => x != null);
  const physical = phys.length ? phys.reduce((a, b) => a + b, 0) / phys.length : null;
  const healers = enemyKeys.filter((k) => HEALERS.has(info[k]?.id));
  const tanks = enemyKeys.filter((k) => (info[k]?.attrs?.durability ?? 0) >= 3 || (info[k]?.tags ?? []).includes('Tank')).length;
  const cc = enemyKeys.reduce((s, k) => s + (info[k]?.attrs?.cc ?? 0), 0);
  const theirItems = enemies.flatMap((p) => (p.items ?? []).map((i) => i.itemID)).filter((id) => items[id] && items[id].cost >= 900);
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
  const path = [...(build?.core?.items ?? [])];
  const slotOf = {};
  (build?.slots ?? []).forEach((slot, i) => {
    const pick = [...slot].sort((a, b) => b.games - a.games).find((o) => !path.includes(o.item));
    if (pick) {
      path.push(pick.item);
      slotOf[pick.item] = i;
    }
  });
  const ownsOrBuilt = (id) => owned.has(id) || [...owned].some((o) => items[o]?.from?.includes(id));
  const next = path.find((id) => !owned.has(id) && items[id]);

  // Items their team calls for, strongest reason first.
  const adapt = [];
  const add = (id, reason, weight) => {
    if (id && items[id]?.buyable && !owned.has(id) && !path.includes(id) && !adapt.some((a) => a.item === id)) adapt.push({ item: id, reason, weight });
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
  const hasBoots = [...owned].some((id) => items[id]?.tags?.includes('Boots') && items[id].cost > 300);
  if (!hasBoots) {
    if ((physical != null && physical >= 0.7) || signals.crit + signals.attackSpeed >= 4) add(ADAPT.boots.armor, 'Bottes contre leurs attaques', 1);
    else if ((physical != null && physical <= 0.4) || cc >= 11) add(ADAPT.boots.magicResist, cc >= 11 ? 'Beaucoup de contrôle en face' : 'Bottes contre leurs dégâts magiques', 1);
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
  if (adapt[0]) alternatives.unshift({ item: adapt[0].item, reason: adapt[0].reason });
  const nextStats = slot?.find((o) => o.item === next);

  return {
    championId: Number(key),
    gold,
    gameTime: Math.round(live.gameData?.gameTime ?? 0),
    gameMode: live.gameData?.gameMode ?? '',
    buy: purchase(next, gold, owned, items),
    nextStats: nextStats && nextStats.games >= MIN_SLOT_GAMES ? { winrate: nextStats.wins / nextStats.games, games: nextStats.games } : null,
    alternatives: alternatives.slice(0, 3),
    path: path.filter((id) => items[id]).map((id) => ({ item: id, owned: ownsOrBuilt(id) || owned.has(id) })),
    adapt: adapt.slice(0, 3).map(({ item, reason }) => ({ item, reason })),
    enemy: { physical, healers: healers.map(Number), tanks, cc, signals, threat },
    skills: build?.skills ? { priority: build.skills.priority, start: build.skills.order.slice(0, 3) } : null,
    source: build ? { games: build.core.games, wins: build.core.wins, queue: build.queue, patch: build.patch } : null,
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
