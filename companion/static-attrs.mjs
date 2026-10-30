// Champion attributes from Riot's own client data (CommunityDragon mirror): ratings from 1 to 3
// and tags such as Initiator or Ally Protection, to read engage, peel and frontline.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/';
const DIR = new URL('../data/local/', import.meta.url);
const PARALLEL = 8;

export const isEngage = (a) => Boolean(a?.tags?.includes('Initiator'));
export const isPeel = (a) => Boolean(a?.tags?.includes('Ally Protection') || (a?.utility >= 3 && a?.cc >= 2));
export const isFrontline = (a) => Boolean((a?.durability ?? 0) >= 3 || a?.tags?.includes('Durable'));

function attributes(c) {
  const ps = c.playstyleInfo ?? {};
  return {
    cc: ps.crowdControl ?? 0,
    durability: ps.durability ?? 0,
    mobility: ps.mobility ?? 0,
    utility: ps.utility ?? 0,
    damage: ps.damage ?? 0,
    tags: [c.championTagInfo?.championTagPrimary, c.championTagInfo?.championTagSecondary].filter(Boolean),
    ranged: c.tacticalInfo?.attackType === 'ranged',
  };
}

export async function loadAttributes(keys, version) {
  const file = new URL(`attrs-${version}.json`, DIR);
  let known = {};
  try {
    known = JSON.parse(await readFile(file, 'utf8'));
    if (keys.every((k) => known[k])) return known;
  } catch {
    // not cached yet
  }
  const missing = keys.filter((k) => !known[k]);
  for (let i = 0; i < missing.length; i += PARALLEL) {
    await Promise.all(
      missing.slice(i, i + PARALLEL).map(async (key) => {
        try {
          const res = await fetch(`${BASE}${key}.json`, { signal: AbortSignal.timeout(15000) });
          if (res.ok) known[key] = attributes(await res.json());
        } catch {
          // one missing champion only loses its tags
        }
      }),
    );
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(known));
  return known;
}
