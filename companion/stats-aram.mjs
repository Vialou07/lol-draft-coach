// ARAM: Mayhem winrates from arammayhem.com (public MCP endpoint, no key, Chinese servers,
// no game counts published). Riot's Match-V5 does not serve Mayhem games, so there is no
// official alternative. Cached on disk for 12 hours.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';

const ENDPOINT = 'https://arammayhem.com/mcp';
const CACHE = new URL('../data/local/aram-mayhem.json', import.meta.url);
const MAX_AGE_MS = 12 * 3600 * 1000;
const PAGE = 30;

async function callTool(name, args, id) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status} ${ENDPOINT}`);
  const body = await res.text();
  // Streamable HTTP answers either plain JSON or a server-sent event carrying it.
  const raw = body.trimStart().startsWith('{') ? body : body.split('\n').find((l) => l.startsWith('data: '))?.slice(6);
  const json = JSON.parse(raw);
  if (json.error) throw new Error(json.error.message);
  return JSON.parse(json.result.content[0].text);
}

// keyById maps Data Dragon ids ("TwistedFate") to numeric keys ("4").
export async function fetchMayhemStats(keyById) {
  const champs = {};
  let meta = null;
  for (let offset = 0, total = Infinity, id = 1; offset < total; offset += PAGE, id++) {
    const page = await callTool('get_tier_list', { limit: PAGE, offset }, id);
    meta ??= page;
    total = page.total ?? 0;
    for (const e of page.entries ?? []) {
      const key = keyById[e.championId];
      const wr = parseFloat(e.winRate) / 100;
      if (key && wr > 0 && wr < 1) champs[key] = { wr, pick: parseFloat(e.pickRate) / 100, tier: e.tier };
    }
    if (!page.entries?.length) break;
  }
  return { source: 'arammayhem.com (serveurs chinois)', version: meta?.patch, date: meta?.dataDate, champs };
}

export async function loadMayhemStats(keyById, { onLog = () => {} } = {}) {
  let cached = null;
  try {
    const age = Date.now() - (await stat(CACHE)).mtimeMs;
    cached = JSON.parse(await readFile(CACHE, 'utf8'));
    if (age < MAX_AGE_MS) return cached;
  } catch {
    // no cache yet
  }
  try {
    const stats = await fetchMayhemStats(keyById);
    if (Object.keys(stats.champs).length < 100) throw new Error(`seulement ${Object.keys(stats.champs).length} champions`);
    await mkdir(new URL('./', CACHE), { recursive: true });
    await writeFile(CACHE, JSON.stringify(stats));
    return stats;
  } catch (e) {
    onLog(`Stats ARAM du Chaos indisponibles (${e.message})${cached ? ', on garde la version précédente' : ''}.`);
    return cached;
  }
}
