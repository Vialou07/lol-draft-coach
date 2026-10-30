// The companion: follows the League client, decodes champ select and serves the live page.

import { findClient, get, tryGet, subscribe, TOPICS } from './lcu.mjs';
import { draftState, draftKey } from './draft.mjs';
import { startServer } from './server.mjs';
import { buildProfile } from './profile.mjs';
import { recommend } from './recommend.mjs';
import { loadStats } from './stats.mjs';

const RETRY_MS = 3000;

export async function startCompanion({ port = 4317, host, lockfile, onLog = () => {} } = {}) {
  const state = {
    status: 'no-client',
    gameflow: 'None',
    summoner: null,
    queue: null,
    draft: null,
    advice: null,
    champions: {},
    updatedAt: 0,
  };
  let profile = null;
  let stats = await loadStats();
  let ws = null;
  let retry = null;
  let stopped = false;
  let lastDraftKey = '';

  const server = await startServer({ port, host, snapshot: () => state });
  const changed = () => {
    state.updatedAt = Date.now();
    server.broadcast();
  };

  const onSession = (session) => {
    state.draft = draftState(session, { gameMode: state.queue?.gameMode });
    const key = draftKey(state.draft);
    if (key === lastDraftKey) return changed(); // timer only
    lastDraftKey = key;
    state.status = 'champ-select';
    state.advice = recommend(state.draft, { stats, profile, champions: state.champions });
    changed();
  };

  const onGameflow = async (client, phase) => {
    state.gameflow = phase;
    if (phase === 'ChampSelect') {
      const flow = await tryGet(client, '/lol-gameflow/v1/session');
      const q = flow?.gameData?.queue;
      state.queue = q ? { id: q.id, gameMode: q.gameMode, name: q.description || q.name || '' } : null;
    }
    if (phase !== 'ChampSelect' && state.status === 'champ-select') {
      state.status = 'connected';
      state.draft = null;
      state.advice = null;
      lastDraftKey = '';
    }
    if (phase === 'EndOfGame') refreshProfile(client);
    changed();
  };

  const refreshProfile = async (client) => {
    profile = await buildProfile(client).catch(() => profile);
  };

  const connect = async () => {
    if (stopped) return;
    const client = findClient(lockfile);
    if (!client) return schedule();
    try {
      const champions = await get(client, '/lol-game-data/assets/v1/champion-summary.json');
      state.champions = Object.fromEntries(
        champions.filter((c) => c.id > 0).map((c) => [c.id, { name: c.name, alias: c.alias, roles: c.roles ?? [] }]),
      );
      const me = await get(client, '/lol-summoner/v1/current-summoner');
      state.summoner = { gameName: me.gameName, tagLine: me.tagLine };
    } catch {
      return schedule(); // client starting up
    }
    await refreshProfile(client);
    stats = await loadStats();

    ws = subscribe(client, [TOPICS.session, TOPICS.gameflow], (topic, event) => {
      if (topic === TOPICS.gameflow) return onGameflow(client, event.data);
      if (event.eventType === 'Delete') {
        state.draft = null;
        state.advice = null;
        lastDraftKey = '';
        state.status = 'connected';
        return changed();
      }
      onSession(event.data);
    });
    ws.on('open', async () => {
      state.status = 'connected';
      onLog(`Connecté au client : ${state.summoner.gameName}#${state.summoner.tagLine}`);
      const phase = await tryGet(client, '/lol-gameflow/v1/gameflow-phase');
      if (phase) await onGameflow(client, phase);
      const session = await tryGet(client, '/lol-champ-select/v1/session');
      if (session) onSession(session);
      changed();
    });
    ws.on('close', () => {
      if (stopped) return;
      Object.assign(state, { status: 'no-client', draft: null, advice: null, gameflow: 'None' });
      lastDraftKey = '';
      changed();
      onLog('Client LoL fermé, en attente...');
      schedule();
    });
    ws.on('error', () => {});
  };

  const schedule = () => {
    if (!stopped) retry = setTimeout(connect, RETRY_MS);
  };

  connect();

  return {
    port: server.port,
    state,
    stop: async () => {
      stopped = true;
      clearTimeout(retry);
      ws?.terminate();
      await server.close();
    },
  };
}
