// The logged-in player's own data, read locally from the client (no Riot API key needed).

import { tryGet } from './lcu.mjs';

const PAGE = 20;
const MAX_GAMES = 200;

async function recentGames(client, who, max) {
  const games = [];
  for (let beg = 0; beg < max; beg += PAGE) {
    const page = await tryGet(client, `/lol-match-history/v1/products/lol/${who}/matches?begIndex=${beg}&endIndex=${beg + PAGE}`);
    const list = page?.games?.games ?? [];
    games.push(...list);
    if (list.length < PAGE) break;
  }
  return games;
}

// Without a puuid: the logged-in player. With one: another player, as their profile page in
// the client shows it (used for friends in the same lobby, never for hidden ranked players).
export async function buildProfile(client, { puuid, maxGames = MAX_GAMES } = {}) {
  const [mastery, games, ranked] = await Promise.all([
    tryGet(client, puuid ? `/lol-champion-mastery/v1/${puuid}/champion-mastery` : '/lol-champion-mastery/v1/local-player/champion-mastery'),
    recentGames(client, puuid ?? 'current-summoner', maxGames),
    tryGet(client, puuid ? `/lol-ranked/v1/ranked-stats/${puuid}` : '/lol-ranked/v1/current-ranked-stats'),
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
