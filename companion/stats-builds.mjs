// Champion builds from u.gg (world, your rank bracket, your role): runes, starting items, core
// items, items 4 to 6 and skill order, with games and wins. Fetched on demand, cached 12 hours.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dataFile } from './paths.mjs';

const MAX_AGE_MS = 12 * 3600 * 1000;
const WORLD = '12';

export const RANK_CODES = {
  IRON: '12', BRONZE: '7', SILVER: '6', GOLD: '5', PLATINUM: '4', EMERALD: '16', DIAMOND: '3',
  MASTER: '14', GRANDMASTER: '14', CHALLENGER: '14',
};
export const DEFAULT_RANK = '10'; // platinum+, for unranked players
export const ROLE_CODES = { top: '4', jungle: '1', mid: '5', bot: '3', support: '2' };

// Entry layout (index: content): 0 runes [games, wins, primary, secondary, perks], 1 spells,
// 2 starting items, 3 core [games, wins, items], 4 skills [games, wins, order, priority],
// 5 items 4/5/6 as [[item, wins, games], ...] (note the flipped order), 6 [wins, games].
export function compactBuild(raw, { rank, role }) {
  const region = raw?.[WORLD] ?? {};
  const byRank = region[rank] ?? region[DEFAULT_RANK] ?? region['8'] ?? Object.values(region)[0] ?? {};
  const roles = Object.entries(byRank);
  if (!roles.length) return null;
  const [, entry] = roles.find(([r]) => r === role) ?? roles.sort((a, b) => (b[1]?.[0]?.[6]?.[1] ?? 0) - (a[1]?.[0]?.[6]?.[1] ?? 0))[0];
  const x = entry?.[0];
  if (!x) return null;
  const pair = (a) => ({ games: a?.[0] ?? 0, wins: a?.[1] ?? 0 });
  return {
    games: x[6]?.[1] ?? 0,
    wins: x[6]?.[0] ?? 0,
    runes: { ...pair(x[0]), primary: x[0]?.[2], secondary: x[0]?.[3], perks: x[0]?.[4] ?? [] },
    spells: { ...pair(x[1]), ids: x[1]?.[2] ?? [] },
    start: { ...pair(x[2]), items: x[2]?.[2] ?? [] },
    core: { ...pair(x[3]), items: x[3]?.[2] ?? [] },
    skills: { ...pair(x[4]), order: x[4]?.[2] ?? [], priority: x[4]?.[3] ?? '' },
    slots: (x[5] ?? []).slice(0, 3).map((list) => (list ?? []).map(([item, wins, games]) => ({ item, wins, games }))),
  };
}

export async function loadBuild(key, { queue = 'ranked_solo_5x5', role = '', rank = DEFAULT_RANK, version }) {
  const [major, minor] = String(version).split('.');
  const patches = [`${major}_${minor}`, `${major}_${Number(minor) - 1}`];
  const roleCode = queue === 'normal_aram' ? '6' : ROLE_CODES[role] ?? '';
  const rankCode = queue === 'normal_aram' ? '8' : rank;
  const file = dataFile('builds', `${queue}-${key}-${rankCode}-${roleCode || 'any'}.json`);
  try {
    if (Date.now() - (await stat(file)).mtimeMs < MAX_AGE_MS) return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // not cached yet
  }
  for (const patch of patches) {
    try {
      const res = await fetch(`https://stats2.u.gg/lol/1.5/overview/${patch}/${queue}/${key}/1.5.0.json`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const build = compactBuild(await res.json(), { rank: rankCode, role: roleCode });
      if (!build) continue;
      build.queue = queue;
      build.patch = patch;
      await mkdir(dataFile('builds'), { recursive: true });
      await writeFile(file, JSON.stringify(build));
      return build;
    } catch {
      // try the previous patch
    }
  }
  return null;
}
