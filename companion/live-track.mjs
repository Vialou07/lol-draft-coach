// The game as the scoreboard shows it, followed over time: the gold each team holds in items
// (the scoreboard shows items, not the sum), kills, who is dead and for how long, and the
// moments worth knowing. Only the official Live Client Data API: nothing hidden is read.

const POINT_EVERY = 10; // seconds of game time between two points of the gold curve
const MAX_POINTS = 360;
const FEED = 7;
const LEGENDARY = 2500; // an item from this cost is a power spike worth telling
// Summoner's Rift respawns from the official wiki; ARAM's are not documented, so none there.
const RESPAWN = { inhib: 300, dragon: 300, baron: 360 };

const DRAGONS = { Fire: 'infernal', Earth: 'de la montagne', Water: 'de l’océan', Air: 'des nuages', Hextech: 'hextech', Chemtech: 'chimtech', Elder: 'ancestral' };

const baseItem = (id, items) => (id >= 120000 && id < 130000 && items[id - 120000] ? id - 120000 : id);

// Event names use the Riot ID game name, older clients the summoner name.
const nameKeys = (p) => [p.riotIdGameName, p.summonerName, p.riotId, p.riotId?.split('#')[0]].filter(Boolean);

export function trackLive(prev, live, { items = {}, championOf = () => null } = {}) {
  const players = live?.allPlayers ?? [];
  const me = players.find((p) => p.riotId && p.riotId === live?.activePlayer?.riotId);
  if (!me) return prev ?? null;
  const t = Math.round(live.gameData?.gameTime ?? 0);
  const key = players.map((p) => p.riotId ?? p.summonerName).sort().join('|');
  const track = prev?.key === key && t >= prev.t - 5 ? { ...prev } : { key, t: 0, points: [], fixedAt: null, floating: false, items: {}, feed: [] };
  const ours = (p) => p.team === me.team;
  const byName = new Map(players.flatMap((p) => nameKeys(p).map((n) => [n, p])));
  // An ARAM copy of an item has its own price: value it as sold, compare it as the original.
  const worth = (p) => (p.items ?? []).reduce((s, i) => s + (items[i.itemID]?.cost ?? items[baseItem(i.itemID, items)]?.cost ?? 0) * (i.count ?? 1), 0);
  const us = players.filter(ours).reduce((s, p) => s + worth(p), 0);
  const them = players.filter((p) => !ours(p)).reduce((s, p) => s + worth(p), 0);

  // The gold curve: a point kept every POINT_EVERY seconds, and the latest read after it.
  // A paused game repeats the same time: it moves the latest point, never adds one.
  const points = [...track.points];
  if (track.floating) points.pop();
  points.push([t, us - them]);
  const fix = t - (track.fixedAt ?? -Infinity) >= POINT_EVERY;
  if (fix) track.fixedAt = t;
  track.floating = !fix;
  track.points = points.slice(-MAX_POINTS);

  // Power spikes: a finished expensive item, seen appear between two reads.
  const feed = [...track.feed];
  const seen = { ...track.items };
  for (const p of players) {
    const id = p.riotId ?? p.summonerName;
    const now = (p.items ?? []).map((i) => baseItem(i.itemID, items)).filter((x) => (items[x]?.cost ?? 0) >= LEGENDARY);
    const before = seen[id];
    if (before) {
      for (const item of now.filter((x) => !before.includes(x))) {
        feed.push({ t, kind: 'item', ally: ours(p), championId: championOf(p), item, text: `${p.championName} a fini ${items[item]?.name ?? item}` });
      }
    }
    seen[id] = now;
  }
  track.items = seen;

  // Kills and objectives from the event list (it holds the whole game, even if we started late).
  const kills = [];
  const objectives = [];
  for (const e of live.events?.Events ?? []) {
    const at = Math.round(e.EventTime ?? 0);
    if (e.EventName === 'ChampionKill') {
      const victim = byName.get(e.VictimName);
      if (victim) kills.push([at, ours(victim) ? 0 : 1]);
    } else if (e.EventName === 'Multikill' && e.KillStreak >= 3) {
      const killer = byName.get(e.KillerName);
      if (killer) objectives.push({ t: at, kind: 'multi', ally: ours(killer), championId: championOf(killer), text: `${{ 3: 'Triple', 4: 'Quadra', 5: 'Penta' }[e.KillStreak] ?? 'Multi'} kill de ${killer.championName}` });
    } else if (e.EventName === 'Ace') {
      const ally = e.AcingTeam === me.team;
      objectives.push({ t: at, kind: 'ace', ally, text: ally ? 'Ace : toute leur équipe est morte' : 'Ace : toute votre équipe est morte' });
    } else if (e.EventName === 'InhibKilled') {
      // Barracks_T1_* belongs to the blue side (ORDER), Barracks_T2_* to the red side (CHAOS).
      const side = /_T1_/.test(e.InhibKilled ?? '') ? 'ORDER' : 'CHAOS';
      const ally = side !== me.team;
      objectives.push({ t: at, kind: 'inhib', ally, text: ally ? 'Leur inhibiteur est tombé' : 'Votre inhibiteur est tombé', back: live.gameData?.gameMode === 'CLASSIC' ? at + RESPAWN.inhib : null });
    } else if (e.EventName === 'DragonKill' || e.EventName === 'BaronKill') {
      const killer = byName.get(e.KillerName);
      const ally = killer ? ours(killer) : null;
      const what = e.EventName === 'BaronKill' ? 'Baron' : `Dragon${DRAGONS[e.DragonType] ? ` ${DRAGONS[e.DragonType]}` : ''}`;
      objectives.push({ t: at, kind: e.EventName === 'BaronKill' ? 'baron' : 'dragon', ally, text: `${what} pour ${ally ? 'vous' : 'eux'}${e.Stolen === 'True' ? ', volé' : ''}`, back: at + (e.EventName === 'BaronKill' ? RESPAWN.baron : RESPAWN.dragon) });
    }
  }
  track.feed = feed.slice(-FEED * 2);
  track.t = t;

  // Who is alive right now, and how long the dead stay dead (the scoreboard shows it too).
  const dead = players.filter((p) => p.isDead).map((p) => ({ championId: championOf(p), ally: ours(p), left: Math.max(0, Math.round(p.respawnTimer ?? 0)) }));
  const alive = { us: players.filter((p) => ours(p) && !p.isDead).length, them: players.filter((p) => !ours(p) && !p.isDead).length };

  return {
    ...track,
    view: {
      t,
      gold: { us, them },
      points: track.points,
      kills,
      score: { us: kills.filter((k) => k[1]).length, them: kills.filter((k) => !k[1]).length },
      alive,
      dead,
      feed: [...track.feed, ...objectives].sort((a, b) => b.t - a.t).slice(0, FEED),
      timers: objectives.filter((o) => o.back && o.back > t).map((o) => ({ kind: o.kind, ally: o.ally, back: o.back })),
    },
  };
}
