// Items from Data Dragon (French names, prices, recipes, tags), cached per patch.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DIR = new URL('../data/local/', import.meta.url);

export function compactItems(raw) {
  const items = {};
  for (const [id, it] of Object.entries(raw.data ?? {})) {
    items[id] = {
      name: it.name,
      cost: it.gold?.total ?? 0,
      from: (it.from ?? []).map(Number),
      tags: it.tags ?? [],
      buyable: Boolean(it.gold?.purchasable) && it.maps?.['11'] !== false,
    };
  }
  return items;
}

export async function loadItems(version) {
  const file = new URL(`items-${version}.json`, DIR);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // not cached yet
  }
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/item.json`, { signal: AbortSignal.timeout(15000) });
    const items = compactItems(await res.json());
    await mkdir(DIR, { recursive: true });
    await writeFile(file, JSON.stringify(items));
    return items;
  } catch {
    return {};
  }
}
