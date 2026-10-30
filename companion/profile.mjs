// The logged-in player's own data, read locally from the client (no Riot API key needed).

import { tryGet } from './lcu.mjs';

const PAGE = 20;
const MAX_GAMES = 200;

async function recentGames(client) {
  const games = [];
  for (let beg = 0; beg < MAX_GAMES; beg += PAGE) {
    const page = await tryGet(client, `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=${beg}&endIndex=${beg + PAGE}`);
    const list = page?.games?.games ?? [];
    games.push(...list);
    if (list.length < PAGE) break;
  }
  return games;
}

export async function buildProfile(client) {
  const [mastery, games, ranked] = await Promise.all([
    tryGet(client, '/lol-champion-mastery/v1/local-player/champion-mastery'),
    recentGames(client),
    tryGet(client, '/lol-ranked/v1/current-ranked-stats'),
  ]);
  const champions = {};
  const entry = (id) => (champions[id] ??= { mastery: 0, level: 0, games: 0, wins: 0, byQueue: {} });
  for (const m of mastery ?? []) Object.assign(entry(m.championId), { mastery: m.championPoints ?? 0, level: m.championLevel ?? 0 });

  const seen = new Set();
  for (const g of games) {
    if (seen.has(g.gameId)) continue;
    seen.add(g.gameId);
    const p = g.participants?.[0];
    if (!p) continue;
    const c = entry(p.championId);
    const q = (c.byQueue[g.queueId] ??= { games: 0, wins: 0 });
    c.games++;
    q.games++;
    if (p.stats?.win) {
      c.wins++;
      q.wins++;
    }
  }
  const solo = ranked?.queueMap?.RANKED_SOLO_5x5;
  return {
    champions,
    rank: solo?.tier && solo.tier !== 'NONE' ? { tier: solo.tier, division: solo.division } : null,
    gamesRead: seen.size,
  };
}
