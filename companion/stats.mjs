// Global champion statistics shipped with the app (built by tools/, refreshed every patch).

import { readFile, readdir } from 'node:fs/promises';

const DIR = new URL('../data/stats/', import.meta.url);

export async function loadStats() {
  const stats = {};
  let files = [];
  try {
    files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    return stats;
  }
  for (const f of files) {
    try {
      stats[f.replace(/\.json$/, '')] = JSON.parse(await readFile(new URL(f, DIR), 'utf8'));
    } catch {
      // A broken file only disables its own mode.
    }
  }
  return stats;
}
