// ARAM Mayhem from the open ARAM-Mayhem-Database project (github.com/Lanternko): winrates with
// their game counts, the best augments of each champion, and each champion's role measured on
// real games (frontline, engage, poke, sustain, crowd control, damage). Taiwan server, current
// patch, hundreds of thousands of games. Cached on disk for 12 hours, kept compact.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { dataFile } from './paths.mjs';

const BASE = 'https://raw.githubusercontent.com/Lanternko/ARAM-Mayhem-Database/main/docs/api/';
const cacheFile = () => dataFile('mayhem-db.json');
const MAX_AGE_MS = 12 * 3600 * 1000;
const MIN_AUGMENT_GAMES = 500; // an augment seen less often with a champion is noise
const AUGMENTS_KEPT = 5; // per rarity
const ROLE_AXES = ['front', 'engage', 'poke', 'sustain', 'cc', 'damage'];

async function getJson(path) {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

// The two files in the shape the app uses: champs[id] = { wr, games, roles, physical },
// augments[id] = { kPrismatic: [{ id, games, wr, lift }], kGold: [...], kSilver: [...] }.
export function compactMayhemDb(tier, augmentStats) {
  const champs = {};
  for (const [id, c] of Object.entries(tier?.champs ?? {})) {
    if (!(c.wr > 0 && c.wr < 1)) continue;
    const comp = c.comp ?? {};
    const dmg = (comp.phys ?? 0) + (comp.magic ?? 0) + (comp.true ?? 0);
    champs[id] = {
      wr: c.wr,
      games: c.g ?? 0,
      roles: Object.fromEntries(ROLE_AXES.filter((k) => comp[k] != null).map((k) => [k, comp[k]])),
      physical: dmg ? +((comp.phys ?? 0) / dmg).toFixed(3) : null,
    };
  }
  const augments = {};
  for (const [id, byRarity] of Object.entries(augmentStats ?? {})) {
    augments[id] = {};
    for (const [rarity, list] of Object.entries(byRarity ?? {})) {
      augments[id][rarity] = (list ?? [])
        .filter((a) => a.g >= MIN_AUGMENT_GAMES && a.lift > 0)
        .sort((a, b) => b.lift - a.lift)
        .slice(0, AUGMENTS_KEPT)
        .map((a) => ({ id: a.id, games: a.g, wr: a.wr, lift: a.lift }));
    }
  }
  return { source: 'ARAM-Mayhem-Database (serveur TW)', version: tier?.patch_prefix ?? null, champs, augments };
}

export async function loadMayhemDb({ onLog = () => {} } = {}) {
  let cached = null;
  try {
    const age = Date.now() - (await stat(cacheFile())).mtimeMs;
    cached = JSON.parse(await readFile(cacheFile(), 'utf8'));
    if (age < MAX_AGE_MS) return cached;
  } catch {
    // no cache yet
  }
  try {
    const tier = await getJson('tier-list.json');
    const augmentStats = await getJson(tier.augmentStatsUrl?.replace(/^api\//, '') ?? 'champions/augment-stats.json');
    const db = compactMayhemDb(tier, augmentStats);
    if (Object.keys(db.champs).length < 100) throw new Error(`seulement ${Object.keys(db.champs).length} champions`);
    await mkdir(dirname(cacheFile()), { recursive: true });
    await writeFile(cacheFile(), JSON.stringify(db));
    return db;
  } catch (e) {
    onLog(`Base ARAM du Chaos indisponible (${e.message})${cached ? ', on garde la version précédente' : ''}.`);
    return cached;
  }
}
