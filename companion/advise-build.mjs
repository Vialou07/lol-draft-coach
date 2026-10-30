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
  penetration: { tank: null, ap: 3135, marksman: 3036, ad: 3071, support: null },
  boots: { armor: 3047, magicResist: 3111 },
};

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

  // Their team, as the scoreboard shows it.
  const enemyKeys = enemies.map((p) => championKeyOf(p, info)).filter(Boolean);
  const phys = enemies.map((p) => physOf(championKeyOf(p, info), role(p))).filter((x) => x != null);
  const physical = phys.length ? phys.reduce((a, b) => a + b, 0) / phys.length : null;
  const healers = enemyKeys.filter((k) => HEALERS.has(info[k]?.id));
  const lifestealItems = enemies.flatMap((p) => p.items ?? []).filter((i) => items[i.itemID]?.tags?.some((t) => t === 'LifeSteal' || t === 'SpellVamp')).length;
  const tanks = enemyKeys.filter((k) => (info[k]?.attrs?.durability ?? 0) >= 3 || (info[k]?.tags ?? []).includes('Tank')).length;
  const cc = enemyKeys.reduce((s, k) => s + (info[k]?.attrs?.cc ?? 0), 0);

  // The usual path: core items, then the most played option for each of the next slots.
  const path = [...(build?.core?.items ?? [])];
  for (const slot of build?.slots ?? []) {
    const pick = [...slot].sort((a, b) => b.games - a.games).find((o) => !path.includes(o.item));
    if (pick) path.push(pick.item);
  }
  const ownsOrBuilt = (id) => owned.has(id) || [...owned].some((o) => items[o]?.from?.includes(id));
  const next = path.find((id) => !owned.has(id) && items[id]);

  const adapt = [];
  const add = (id, reason) => {
    if (id && items[id]?.buyable && !owned.has(id) && !path.includes(id) && !adapt.some((a) => a.item === id)) adapt.push({ item: id, reason });
  };
  if (healers.length || lifestealItems >= 2) {
    const names = healers.map((k) => info[k]?.name).slice(0, 2).join(', ');
    add(ADAPT.antiHeal[kind], names ? `Contre leurs soins (${names})` : 'Contre leur vol de vie');
  }
  if (physical != null && physical >= 0.65) add(ADAPT.armor[kind], `Ils sont très AD (${Math.round(physical * 100)} %)`);
  if (physical != null && physical <= 0.4) add(ADAPT.magicResist[kind], `Ils sont très AP (${Math.round((1 - physical) * 100)} %)`);
  if (tanks >= 2) add(ADAPT.penetration[kind], `${tanks} tanks en face`);
  const hasBoots = [...owned].some((id) => items[id]?.tags?.includes('Boots') && items[id].cost > 300);
  if (!hasBoots) {
    if (physical != null && physical >= 0.7) add(ADAPT.boots.armor, 'Bottes contre leurs dégâts physiques');
    else if ((physical != null && physical <= 0.4) || cc >= 11) add(ADAPT.boots.magicResist, cc >= 11 ? 'Beaucoup de contrôle en face' : 'Bottes contre leurs dégâts magiques');
  }

  return {
    championId: Number(key),
    gold,
    gameTime: Math.round(live.gameData?.gameTime ?? 0),
    gameMode: live.gameData?.gameMode ?? '',
    buy: purchase(next, gold, owned, items),
    path: path.filter((id) => items[id]).map((id) => ({ item: id, owned: ownsOrBuilt(id) || owned.has(id) })),
    adapt: adapt.slice(0, 3),
    enemy: { physical, healers: healers.map(Number), tanks, cc },
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
