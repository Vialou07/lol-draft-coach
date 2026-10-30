// The logged-in player's own data, read locally from the client (no Riot API key needed).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tryGet } from './lcu.mjs';
import { dataFile } from './paths.mjs';

const PAGE = 20;
const MAX_GAMES = 200;
const SR_QUEUES = new Set([400, 420, 430, 440, 480, 490, 700]);
const matchupCache = () => dataFile('history-matchups.json');

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

// Lane of a participant in a finished game, from the client's game details.
function laneOf(p) {
  const position = String(p.teamPosition ?? p.individualPosition ?? '').toUpperCase();
  const fromPosition = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'bot', UTILITY: 'support' }[position];
  if (fromPosition) return fromPosition;
  const lane = String(p.timeline?.lane ?? '').toUpperCase();
  const role = String(p.timeline?.role ?? '').toUpperCase();
  if (lane === 'TOP') return 'top';
  if (lane === 'JUNGLE') return 'jungle';
  if (lane === 'MIDDLE' || lane === 'MID') return 'mid';
  if (lane === 'BOTTOM' || lane === 'BOT') return role === 'DUO_SUPPORT' ? 'support' : 'bot';
  return '';
}

// Your own lane matchups: for each Summoner's Rift game, your champion, your lane opponent's
// and the result. Game details are fetched once and kept locally.
async function laneMatchups(client, games, puuid) {
  let cache = {};
  try {
    cache = JSON.parse(await readFile(matchupCache(), 'utf8'));
  } catch {
    // first run
  }
  let fetched = 0;
  for (const g of games) {
    if (!SR_QUEUES.has(g.queueId) || cache[g.gameId] !== undefined) continue;
    const detail = await tryGet(client, `/lol-match-history/v1/games/${g.gameId}`);
    fetched++;
    const ident = detail?.participantIdentities?.find((i) => i.player?.puuid === puuid);
    const me = detail?.participants?.find((p) => p.participantId === ident?.participantId);
    const lane = me && laneOf(me);
    const opponent = lane && detail.participants.find((p) => p.teamId !== me.teamId && laneOf(p) === lane);
    cache[g.gameId] = opponent ? [me.championId, opponent.championId, me.stats?.win ? 1 : 0, lane] : null;
  }
  if (fetched) {
    await mkdir(dataFile(), { recursive: true });
    await writeFile(matchupCache(), JSON.stringify(cache));
  }
  const ids = new Set(games.map((g) => String(g.gameId)));
  const matchups = {};
  for (const [gameId, row] of Object.entries(cache)) {
    if (!row || !ids.has(gameId)) continue;
    const [mine, theirs, win] = row;
    const cell = ((matchups[mine] ??= {})[theirs] ??= { games: 0, wins: 0 });
    cell.games++;
    cell.wins += win;
  }
  return matchups;
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
  const unique = [];
  for (const g of games) {
    if (seen.has(g.gameId)) continue;
    seen.add(g.gameId);
    unique.push(g);
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
  let matchups = {};
  if (!puuid) {
    const me = await tryGet(client, '/lol-summoner/v1/current-summoner');
    if (me?.puuid) matchups = await laneMatchups(client, unique, me.puuid).catch(() => ({}));
  }
  const solo = ranked?.queueMap?.RANKED_SOLO_5x5;
  return {
    champions,
    matchups,
    rank: solo?.tier && solo.tier !== 'NONE' ? { tier: solo.tier, division: solo.division } : null,
    gamesRead: seen.size,
  };
}

// What the waiting screen shows about you: comfort picks, your best and worst lane matchups,
// your ARAM Mayhem champions. Counts are shown as they are; small samples stay small.
export function profileSummary(profile) {
  if (!profile) return null;
  const sr = (c) => Object.entries(c.byQueue).filter(([q]) => SR_QUEUES.has(Number(q))).reduce((a, [, r]) => ({ games: a.games + r.games, wins: a.wins + r.wins }), { games: 0, wins: 0 });
  const comfort = Object.entries(profile.champions)
    .map(([id, c]) => ({ championId: Number(id), ...sr(c) }))
    .filter((c) => c.games > 0)
    .sort((a, b) => b.games - a.games)
    .slice(0, 6);
  const aram = Object.entries(profile.champions)
    .map(([id, c]) => ({ championId: Number(id), ...(c.byQueue[2400] ?? { games: 0, wins: 0 }) }))
    .filter((c) => c.games > 0)
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 6);
  const pairs = [];
  for (const [mine, list] of Object.entries(profile.matchups ?? {})) {
    for (const [theirs, r] of Object.entries(list)) if (r.games >= 2) pairs.push({ championId: Number(mine), vs: Number(theirs), ...r, score: (r.wins + 1) / (r.games + 2) });
  }
  pairs.sort((a, b) => b.score - a.score || b.games - a.games);
  return {
    gamesRead: profile.gamesRead,
    rank: profile.rank,
    comfort,
    aram,
    favorable: pairs.filter((p) => p.score > 0.5).slice(0, 3),
    hard: [...pairs].reverse().filter((p) => p.score < 0.5).slice(0, 3),
  };
}
