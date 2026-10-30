// Extracts real champ select sessions from the League client logs into anonymised test fixtures.
// The client logs every /lol-champ-select/v1/session update, so past games become replayable.
// Usage: node tools/extract-log-sessions.mjs [logDir] [outDir]

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const logDir = process.argv[2] ?? 'C:/Riot Games/League of Legends/Logs/LeagueClient Logs';
const outDir = process.argv[3] ?? new URL('../test/fixtures/real/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const MARKER = '/lol-champ-select/v1/session: ';

// Identity and chat credentials never leave the player's PC.
const PLAYER_FIELDS = ['gameName', 'tagLine', 'puuid', 'summonerId', 'obfuscatedPuuid', 'obfuscatedSummonerId', 'playerAlias', 'internalName'];

function anonymise(session) {
  const { chatDetails, id, gameId, ...rest } = session;
  const player = (p, i) => {
    const copy = { ...p };
    for (const f of PLAYER_FIELDS) delete copy[f];
    copy.anonName = `Joueur ${i + 1}`;
    return copy;
  };
  return { ...rest, myTeam: (rest.myTeam ?? []).map(player), theirTeam: (rest.theirTeam ?? []).map(player) };
}

mkdirSync(outDir, { recursive: true });
const games = new Map();

for (const file of readdirSync(logDir).filter((f) => f.endsWith('_LeagueClient.log')).sort()) {
  for (const line of readFileSync(join(logDir, file), 'utf8').split('\n')) {
    const at = line.indexOf(MARKER);
    if (at < 0) continue;
    let session;
    try {
      session = JSON.parse(line.slice(at + MARKER.length));
    } catch {
      continue;
    }
    const key = session.id ?? `${file}-${session.gameId}`;
    if (!games.has(key)) games.set(key, { file, queueId: session.queueId, events: [], last: '' });
    const game = games.get(key);
    const clean = anonymise(session);
    // Timer-only updates add nothing to a replay.
    const signature = JSON.stringify({ ...clean, timer: clean.timer?.phase, counter: 0 });
    if (signature === game.last) continue;
    game.last = signature;
    // Line prefix is seconds since the log started, e.g. "000134.543|".
    game.events.push({ t: Math.round(Number(line.slice(0, line.indexOf('|'))) * 1000), session: clean });
  }
}

const counts = {};
for (const game of games.values()) {
  counts[game.queueId] = (counts[game.queueId] ?? 0) + 1;
  const name = `q${game.queueId}-${game.file.slice(0, 10)}-${String(counts[game.queueId]).padStart(2, '0')}.json`;
  writeFileSync(join(outDir, name), JSON.stringify({ queueId: game.queueId, source: game.file, events: game.events }));
}
console.log(`${games.size} sélections extraites dans ${outDir}`, counts);
