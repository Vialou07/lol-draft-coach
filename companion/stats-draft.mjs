// Summoner's Rift statistics: DraftGap's public datasets (Lolalytics, Emerald+, all regions),
// compacted into what the draft model needs and cached on disk for 12 hours.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';

const SOURCES = {
  month: 'https://bucket.draftgap.com/datasets/v5/30-days.json',
  patch: 'https://bucket.draftgap.com/datasets/v5/current-patch.json',
};
const CACHE = new URL('../data/local/draft-stats.json', import.meta.url);
const MAX_AGE_MS = 12 * 3600 * 1000;
const MIN_PAIR_GAMES = 30;
const SCHEMA = 2; // bump when compact() changes, so old caches are rebuilt

export const ROLE_INDEX = { top: 0, jungle: 1, mid: 2, bot: 3, support: 4 };

// Keeps per champion and role: [games, wins] over 30 days and the current patch, the
// physical damage share, [games, wins] by game length (5 buckets, short to long), and
// matchup/synergy records with enough games to matter.
export function compact(month, patch) {
  const champs = {};
  const mu = {};
  const sy = {};
  const roleTotals = [0, 0, 0, 0, 0].map(() => ({ g: 0, w: 0 }));
  for (const [key, c] of Object.entries(month.championData)) {
    const roles = [];
    for (let r = 0; r < 5; r++) {
      const m = c.statsByRole[r] ?? { games: 0, wins: 0 };
      const p = patch?.championData?.[key]?.statsByRole?.[r] ?? { games: 0, wins: 0 };
      const dp = m.damageProfile ?? {};
      const dmg = (dp.physical ?? 0) + (dp.magic ?? 0) + (dp.true ?? 0);
      const byTime = Object.values(m.statsByTime ?? {}).map((b) => [Math.round(b.games), Math.round(b.wins)]);
      roles.push([Math.round(m.games), Math.round(m.wins), Math.round(p.games), Math.round(p.wins), dmg ? +(dp.physical / dmg).toFixed(3) : null, byTime]);
      roleTotals[r].g += m.games;
      roleTotals[r].w += m.wins;
      for (const [field, out] of [['matchup', mu], ['synergy', sy]]) {
        const byRole = m[field] ?? {};
        const kept = {};
        for (const [r2, list] of Object.entries(byRole)) {
          for (const [k2, rec] of Object.entries(list)) {
            if (rec.games >= MIN_PAIR_GAMES) kept[`${r2}:${k2}`] = [Math.round(rec.games), Math.round(rec.wins)];
          }
        }
        if (Object.keys(kept).length) out[`${key}:${r}`] = kept;
      }
    }
    champs[key] = { name: c.name, id: c.id, roles };
  }
  return {
    schema: SCHEMA,
    source: 'DraftGap / Lolalytics, Emerald+, toutes régions',
    version: patch?.version ?? month.version,
    date: month.date,
    roleWinrate: roleTotals.map((t) => (t.g ? t.w / t.g : 0.5)),
    champs,
    mu,
    sy,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function loadDraftStats({ onLog = () => {} } = {}) {
  let cached = null;
  try {
    const age = Date.now() - (await stat(CACHE)).mtimeMs;
    cached = JSON.parse(await readFile(CACHE, 'utf8'));
    if (cached.schema !== SCHEMA) cached = null;
    else if (age < MAX_AGE_MS) return cached;
  } catch {
    // no cache yet
  }
  try {
    onLog('Téléchargement des stats de draft (environ 55 Mo)...');
    const [month, patch] = await Promise.all([fetchJson(SOURCES.month), fetchJson(SOURCES.patch)]);
    const stats = compact(month, patch);
    await mkdir(new URL('./', CACHE), { recursive: true });
    await writeFile(CACHE, JSON.stringify(stats));
    onLog(`Stats de draft à jour (patch ${stats.version}).`);
    return stats;
  } catch (e) {
    onLog(`Stats de draft indisponibles (${e.message})${cached ? ', on garde la version précédente' : ''}.`);
    return cached;
  }
}
