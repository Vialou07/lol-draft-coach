// The evening: every game of the night for you and the friends who played with you, kept on
// this PC, so the group can compare damage, healing and wins game after game.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dataFile } from './paths.mjs';

const file = () => dataFile('evenings.json');
const KEPT = 80;
const DAY_STARTS_AT = 6; // a game played at 1 a.m. belongs to the evening before

// When the current evening began, in local time.
export function eveningStart(now = new Date()) {
  const start = new Date(now);
  start.setHours(DAY_STARTS_AT, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start.getTime();
}

// A game as the evening needs it: your line and your friends' lines, with their team's share.
export function eveningGame(recap, { friends = new Set() } = {}) {
  if (!recap?.players?.length) return null;
  const teamDamage = (ally) => recap.players.filter((p) => p.ally === ally).reduce((s, p) => s + p.damage, 0) || 1;
  const group = recap.players.filter((p) => p.me || (p.puuid && friends.has(p.puuid)));
  return {
    gameId: recap.gameId,
    at: recap.at,
    duration: recap.duration,
    queueId: recap.queueId,
    players: group.map((p) => ({
      name: p.name,
      me: p.me,
      championId: p.championId,
      win: p.ally ? recap.win : !recap.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      damage: p.damage,
      share: p.damage / teamDamage(p.ally),
      heal: p.heal,
      taken: p.taken,
      gold: p.gold,
    })),
  };
}

export async function loadEvenings() {
  try {
    return JSON.parse(await readFile(file(), 'utf8'));
  } catch {
    return [];
  }
}

export async function saveEveningGame(games, game) {
  if (!game || games.some((g) => g.gameId === game.gameId)) return games;
  const next = [...games, game].sort((a, b) => a.at - b.at).slice(-KEPT);
  await mkdir(dataFile(), { recursive: true });
  await writeFile(file(), JSON.stringify(next));
  return next;
}

export const tonight = (games, now = new Date()) => games.filter((g) => g.at >= eveningStart(now));
