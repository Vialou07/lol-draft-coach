// Static champion data from Data Dragon (difficulty, classes), cached per patch.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dataFile } from './paths.mjs';


export function championInfo(ddragon) {
  return Object.fromEntries(
    Object.values(ddragon.data).map((c) => [c.key, { id: c.id, name: c.name, difficulty: c.info?.difficulty ?? 5, tags: c.tags ?? [], defense: c.info?.defense ?? 0 }]),
  );
}

export async function loadChampionInfo(version) {
  const file = dataFile(`ddragon-${version}.json`);
  try {
    return championInfo(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    // not cached yet
  }
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    await mkdir(dataFile(), { recursive: true });
    await writeFile(file, body);
    return championInfo(JSON.parse(body));
  } catch {
    return {};
  }
}
