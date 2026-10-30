// Stand-in for the League client's local API: HTTPS + WAMP websocket on one port, writing a
// lockfile like the real client. It replays a real champ select recorded from the client logs.

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import { WebSocketServer } from 'ws';

const PASSWORD = 'fake-token';
const AUTH = `Basic ${Buffer.from(`riot:${PASSWORD}`).toString('base64')}`;
const QUEUES = {
  420: { gameMode: 'CLASSIC', description: 'Classée Solo/Duo' },
  440: { gameMode: 'CLASSIC', description: 'Classée Flexible' },
  2400: { gameMode: 'KIWI', description: 'ARAM du Chaos' },
  1700: { gameMode: 'CHERRY', description: 'Arena' },
};

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const ddragon = read('./fixtures/ddragon-champions.json');
const augments = read('./fixtures/augments-sample.json');
const summary = [{ id: -1, name: 'Aucun', alias: 'None' }].concat(
  Object.values(ddragon.data).map((c) => ({ id: Number(c.key), name: c.name, alias: c.id, roles: c.tags.map((t) => t.toLowerCase()) })),
);

export function loadFixture(file) {
  return read(`./fixtures/real/${file}`);
}

export async function startFakeClient({ fixture, lockfile, speed = 20, minGapMs = 5, holdAtEnd = false, profile = defaultProfile(), augmentList = augments }) {
  let phase = 'Lobby';
  let session = null;
  const sockets = new Set();

  const routes = {
    '/lol-game-data/assets/v1/champion-summary.json': () => summary,
    '/lol-summoner/v1/current-summoner': () => ({ gameName: 'Testeur', tagLine: 'EUW', puuid: 'fake-puuid' }),
    '/lol-gameflow/v1/gameflow-phase': () => phase,
    '/lol-gameflow/v1/session': () => ({ phase, gameData: { queue: { id: fixture.queueId, ...QUEUES[fixture.queueId] } } }),
    '/lol-champ-select/v1/session': () => session,
    '/lol-champion-mastery/v1/local-player/champion-mastery': () => profile.mastery,
    '/lol-ranked/v1/current-ranked-stats': () => profile.ranked,
    '/lol-game-data/assets/v1/cherry-augments.json': () => augmentList,
  };

  const key = readFileSync(new URL('./certs/key.pem', import.meta.url));
  const cert = readFileSync(new URL('./certs/cert.pem', import.meta.url));
  const server = https.createServer({ key, cert }, (req, res) => {
    if (req.headers.authorization !== AUTH) return res.writeHead(401).end();
    const path = req.url.split('?')[0];
    if (path === '/lol-match-history/v1/products/lol/current-summoner/matches') {
      const beg = Number(new URL(req.url, 'https://x').searchParams.get('begIndex'));
      return res.writeHead(200).end(JSON.stringify({ games: { games: profile.games.slice(beg, beg + 20) } }));
    }
    const gameId = path.match(/^\/lol-match-history\/v1\/games\/(\d+)$/)?.[1];
    if (gameId) {
      const g = profile.games.find((x) => String(x.gameId) === gameId);
      if (!g) return res.writeHead(404).end('{}');
      const me = g.participants[0];
      return res.writeHead(200).end(JSON.stringify({
        gameId: g.gameId,
        participantIdentities: [{ participantId: 1, player: { puuid: 'fake-puuid' } }, { participantId: 6, player: { puuid: 'other' } }],
        participants: [
          { participantId: 1, teamId: 100, championId: me.championId, stats: me.stats, timeline: { lane: 'BOTTOM', role: 'DUO_SUPPORT' } },
          { participantId: 6, teamId: 200, championId: g.opponent ?? 412, stats: { win: !me.stats.win }, timeline: { lane: 'BOTTOM', role: 'DUO_SUPPORT' } },
        ],
      }));
    }
    const body = routes[path]?.();
    if (body == null) return res.writeHead(404).end('{}');
    res.writeHead(200).end(JSON.stringify(body));
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    if (req.headers.authorization !== AUTH) return ws.close();
    ws.topics = new Set();
    ws.on('message', (raw) => {
      const [type, topic] = JSON.parse(raw);
      if (type === 5) ws.topics.add(topic);
    });
    sockets.add(ws);
    ws.on('close', () => sockets.delete(ws));
  });

  const push = (topic, eventType, data, uri) => {
    for (const ws of sockets) if (ws.topics.has(topic)) ws.send(JSON.stringify([8, topic, { eventType, data, uri }]));
  };
  const setPhase = (p) => {
    phase = p;
    push('OnJsonApiEvent_lol-gameflow_v1_gameflow-phase', 'Update', p, '/lol-gameflow/v1/gameflow-phase');
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  writeFileSync(lockfile, `LeagueClient:4242:${port}:${PASSWORD}:https`);

  return {
    port,
    subscribers: () => [...sockets].filter((ws) => ws.topics.size > 0).length,
    // Replays the recorded champ select, compressing the original timing by `speed`.
    async play() {
      setPhase('ChampSelect');
      const topic = 'OnJsonApiEvent_lol-champ-select_v1_session';
      const uri = '/lol-champ-select/v1/session';
      let prevT = fixture.events[0].t;
      for (const [i, e] of fixture.events.entries()) {
        await sleep(Math.max(minGapMs, (e.t - prevT) / speed));
        prevT = e.t;
        session = e.session;
        push(topic, i === 0 ? 'Create' : 'Update', session, uri);
      }
      if (holdAtEnd) return;
      await sleep(minGapMs);
      session = null;
      push(topic, 'Delete', null, uri);
      setPhase('InProgress');
    },
    async stop() {
      for (const ws of sockets) ws.terminate();
      await new Promise((r) => server.close(r));
      rmSync(lockfile, { force: true });
    },
  };
}

function defaultProfile() {
  return {
    mastery: [
      { championId: 893, championLevel: 12, championPoints: 154000 },
      { championId: 120, championLevel: 7, championPoints: 61000 },
    ],
    ranked: { queueMap: { RANKED_SOLO_5x5: { tier: 'GOLD', division: 'II' } } },
    games: Array.from({ length: 45 }, (_, i) => ({
      gameId: 1000 + i,
      queueId: i % 3 ? 2400 : 420,
      opponent: [412, 89, 117][i % 3],
      participants: [{ championId: [893, 120, 22][i % 3], stats: { win: i % 2 === 0 } }],
    })),
  };
}
