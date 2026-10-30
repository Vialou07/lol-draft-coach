// Who does what in each team, from the scoreboard and measured roles: what the game does not
// tell you. Roles come from real ARAM Mayhem games (ARAM-Mayhem-Database); the threat is an
// estimate of each player's share of their team's damage, which Riot only gives after the game.

// A role counts when the champion is in the top 15 % of all champions on that axis.
const ROLE_CUTS = [['front', 2.5, 'Tank'], ['engage', 1.15, 'Engage'], ['sustain', 2.5, 'Soins'], ['cc', 2.5, 'Contrôles'], ['poke', 1.85, 'Poke'], ['damage', 2.5, 'Gros dégâts']];
// Damage share ∝ class weight × item gold × (kill participation + 0.1), fitted on the 200 players
// of the owner's last 20 games (30/10/2026): it names the team's top damage dealer 25 times out
// of 40, and has them in its top two 35 times out of 40.
const CLASS_WEIGHT = { Tank: 0.94, Support: 0.53, Mage: 1.06, Marksman: 1.04, Fighter: 1.14, Assassin: 1.14 };
export const THREAT_HIT = { top2: 35, teams: 40 };

const baseItem = (id, items) => (id >= 120000 && id < 130000 && items[id - 120000] ? id - 120000 : id);

export function rolesOf(key, { db, info }) {
  const measured = db?.champs?.[key]?.roles;
  if (measured) {
    return ROLE_CUTS.filter(([axis, cut]) => (measured[axis] ?? 0) >= cut)
      .sort((a, b) => measured[b[0]] / b[1] - measured[a[0]] / a[1])
      .slice(0, 2)
      .map(([, , label]) => label);
  }
  // Without measures, the client's class tags.
  const tags = info?.[key]?.tags ?? [];
  return tags.slice(0, 1).map((t) => ({ Tank: 'Tank', Support: 'Soutien', Mage: 'Mage', Marksman: 'Tireur', Fighter: 'Combattant', Assassin: 'Assassin' })[t] ?? t);
}

export function teamRoles(live, { items = {}, info = {}, db = null, keyOf = () => null, physOf = () => null } = {}) {
  const players = live?.allPlayers ?? [];
  const me = players.find((p) => p.riotId && p.riotId === live?.activePlayer?.riotId);
  if (!me) return null;
  const read = (p) => {
    const key = keyOf(p);
    const gold = (p.items ?? []).reduce((s, i) => s + (items[i.itemID]?.cost ?? items[baseItem(i.itemID, items)]?.cost ?? 0) * (i.count ?? 1), 0);
    const physical = db?.champs?.[key]?.physical ?? physOf(key);
    return {
      championId: Number(key) || null,
      name: p.championName,
      ally: p.team === me.team,
      me: p === me,
      level: p.level ?? 0,
      kills: p.scores?.kills ?? 0,
      deaths: p.scores?.deaths ?? 0,
      assists: p.scores?.assists ?? 0,
      gold,
      roles: key ? rolesOf(key, { db, info }) : [],
      damage: physical == null ? null : physical >= 0.65 ? 'AD' : physical <= 0.35 ? 'AP' : 'Mixte',
      cls: info[key]?.tags?.[0] ?? 'Fighter',
    };
  };
  const all = players.map(read);
  for (const ally of [true, false]) {
    const team = all.filter((x) => x.ally === ally);
    const kills = team.reduce((s, x) => s + x.kills, 0) || 1;
    const raw = team.map((x) => (CLASS_WEIGHT[x.cls] ?? 1) * Math.max(x.gold, 1) * ((x.kills + x.assists) / kills + 0.1));
    const sum = raw.reduce((s, v) => s + v, 0);
    team.forEach((x, i) => (x.threat = raw[i] / sum));
    const top = [...team].sort((a, b) => b.threat - a.threat).slice(0, 2);
    for (const x of top) x.top = true;
  }
  return {
    allies: all.filter((x) => x.ally).sort((a, b) => b.threat - a.threat),
    enemies: all.filter((x) => !x.ally).sort((a, b) => b.threat - a.threat),
    measured: Boolean(db),
  };
}

// The augments that win most with a champion, by rarity, with names and icons from the client.
export function augmentAdvice(key, { db, names = {} }) {
  const byRarity = db?.augments?.[key];
  if (!byRarity) return null;
  const out = {};
  for (const rarity of ['kPrismatic', 'kGold', 'kSilver']) {
    const list = (byRarity[rarity] ?? []).filter((a) => names[a.id]).slice(0, 4);
    if (list.length) out[rarity] = list.map((a) => ({ ...a, name: names[a.id].name, icon: names[a.id].icon }));
  }
  return Object.keys(out).length ? { championId: Number(key), source: db.source, version: db.version, byRarity: out } : null;
}
