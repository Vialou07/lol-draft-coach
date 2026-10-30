// Champion strength at the player's own rank: u.gg tier list (world, ranked solo), one small
// file per rank bracket, refreshed daily. The Emerald+ matchups stay the base; this only moves
// each champion's meta strength towards what it does at your elo.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dataFile } from './paths.mjs';

const MAX_AGE_MS = 12 * 3600 * 1000;
const ROLES = { top: 0, jungle: 1, mid: 2, adc: 3, supp: 4 };

export const TIER_SLUGS = {
  IRON: 'iron', BRONZE: 'bronze', SILVER: 'silver', GOLD: 'gold', PLATINUM: 'platinum',
  EMERALD: 'emerald', DIAMOND: 'diamond', MASTER: 'master_plus', GRANDMASTER: 'master_plus', CHALLENGER: 'master_plus',
};
export const TIER_NAMES = {
  iron: 'Fer', bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine', emerald: 'Émeraude',
  diamond: 'Diamant', master_plus: 'Master+', platinum_plus: 'Platine+',
};
export const DEFAULT_TIER = 'platinum_plus'; // unranked players: a broad bracket

const url = (tier, patch) => `https://stats2.u.gg/lol/1.5/champion_ranking/world/${patch}/ranked_solo_5x5/${tier}/1.5.0.json`;

// Entry layout: [championId, counters, wins, games, ...]; per-role lists under key "0".
export function compactElo(raw, tier, patch) {
  const champs = {};
  const totals = [0, 1, 2, 3, 4].map(() => [0, 0]);
  for (const [role, list] of Object.entries(raw?.['0'] ?? {})) {
    const r = ROLES[role];
    if (r == null) continue;
    for (const entry of list) {
      const [key, , wins, games] = entry;
      if (!(games > 0)) continue;
      (champs[key] ??= [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]])[r] = [games, wins];
      totals[r][0] += games;
      totals[r][1] += wins;
    }
  }
  return { tier, patch, roleWinrate: totals.map(([g, w]) => (g ? w / g : 0.5)), champs };
}

export async function loadEloStats(tier, version, { onLog = () => {} } = {}) {
  const [major, minor] = String(version).split('.');
  const patches = [`${major}_${minor}`, `${major}_${Number(minor) - 1}`]; // patch day: yesterday's file
  const cache = dataFile(`elo-${tier}.json`);
  let cached = null;
  try {
    cached = JSON.parse(await readFile(cache, 'utf8'));
    if (Date.now() - (await stat(cache)).mtimeMs < MAX_AGE_MS && patches.includes(cached.patch)) return cached;
  } catch {
    // no cache yet
  }
  for (const patch of patches) {
    try {
      const res = await fetch(url(tier, patch), { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const stats = compactElo(await res.json(), tier, patch);
      if (Object.keys(stats.champs).length < 100) continue;
      await mkdir(dataFile(), { recursive: true });
      await writeFile(cache, JSON.stringify(stats));
      return stats;
    } catch {
      // try the previous patch
    }
  }
  onLog(`Stats à ton elo (${tier}) indisponibles${cached ? ', on garde la version précédente' : ''}.`);
  return cached;
}
