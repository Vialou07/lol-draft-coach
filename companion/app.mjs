// The companion: follows the League client, decodes champ select and serves the live page.

import { findClient, get, getBinary, tryGet, subscribe, TOPICS } from './lcu.mjs';
import { draftState, draftKey } from './draft.mjs';
import { startServer } from './server.mjs';
import { buildProfile } from './profile.mjs';
import { recommend } from './recommend.mjs';
import { loadDraftStats } from './stats-draft.mjs';
import { loadMayhemStats } from './stats-aram.mjs';
import { loadChampionInfo } from './static-data.mjs';

const RETRY_MS = 3000;
const DDRAGON_FALLBACK = '16.21.1';

async function latestDdragon() {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { signal: AbortSignal.timeout(3000) });
    return (await res.json())[0] ?? DDRAGON_FALLBACK;
  } catch {
    return DDRAGON_FALLBACK;
  }
}

const defaultStats = async ({ onLog, info }) => {
  const keyById = Object.fromEntries(Object.entries(info).map(([key, c]) => [c.id, key]));
  const [draft, mayhem] = await Promise.all([loadDraftStats({ onLog }), loadMayhemStats(keyById, { onLog })]);
  return { draft, mayhem };
};

export async function startCompanion({ port = 4317, host, lockfile, onLog = () => {}, loadStats = defaultStats, loadInfo = loadChampionInfo } = {}) {
  const state = {
    status: 'no-client',
    gameflow: 'None',
    summoner: null,
    queue: null,
    draft: null,
    advice: null,
    champions: {},
    assets: { ddragon: await latestDdragon() },
    updatedAt: 0,
  };
  let client = null;
  const icons = new Map();
  const icon = async (id) => {
    if (icons.has(id)) return icons.get(id);
    if (!client) return null;
    const png = await getBinary(client, `/lol-game-data/assets/v1/champion-icons/${id}.png`).catch(() => null);
    if (png) icons.set(id, png);
    return png;
  };
  let profile = null;
  let stats = {};
  let info = {};
  let pickable = null;
  let ws = null;
  let retry = null;
  let stopped = false;
  let lastDraftKey = '';

  const server = await startServer({ port, host, snapshot: () => state, icon });
  const changed = () => {
    state.updatedAt = Date.now();
    server.broadcast();
  };

  const advise = () => {
    if (!state.draft) return;
    try {
      state.advice = recommend(state.draft, { stats, profile, champions: state.champions, pickable, info });
    } catch (e) {
      onLog(`Erreur de calcul : ${e.message}`);
      state.advice = { options: [], note: 'Conseil indisponible pour ce moment de la draft.' };
    }
  };

  const onSession = (session) => {
    const fresh = state.status !== 'champ-select';
    state.draft = draftState(session, { gameMode: state.queue?.gameMode });
    const key = draftKey(state.draft);
    if (key === lastDraftKey) return changed(); // timer only
    lastDraftKey = key;
    state.status = 'champ-select';
    if (fresh) {
      pickable = null;
      const me = state.draft.allies.find((p) => p.me);
      onLog(`Sélection : file ${state.draft.queueId} (${state.queue?.gameMode ?? '?'}), mode ${state.draft.kind}, rôle ${me?.role || '-'}`);
      tryGet(client, '/lol-champ-select/v1/pickable-champion-ids').then((ids) => {
        onLog(`Champions jouables : ${Array.isArray(ids) ? ids.length : 'indisponible'}`);
        if (!Array.isArray(ids) || state.status !== 'champ-select') return;
        pickable = ids;
        advise();
        changed();
      });
    }
    const before = JSON.stringify(state.advice?.options?.[0] ?? null);
    advise();
    const top = state.advice?.options?.[0];
    if (JSON.stringify(top ?? null) !== before && top) {
      onLog(`Conseil (${state.draft.phase}${state.draft.myTurn ? `, ton ${state.draft.myTurn}` : ''}) : ${state.advice.verb} ${state.champions[top.championId]?.name ?? top.championId} ${top.p != null ? Math.round(top.p * 100) + ' %' : ''}`);
    }
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
    profile = await buildProfile(client).catch((e) => {
      onLog(`Profil indisponible : ${e.message}`);
      return profile;
    });
    if (profile) {
      const known = Object.values(profile.champions).filter((c) => c.games || c.mastery).length;
      onLog(`Profil : ${profile.gamesRead} parties lues, ${known} champions connus, rang ${profile.rank ? `${profile.rank.tier} ${profile.rank.division}` : 'aucun'}`);
    }
  };

  const connect = async () => {
    if (stopped) return;
    client = findClient(lockfile);
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

    ws = subscribe(client, [TOPICS.session, TOPICS.gameflow], (topic, event) => {
      if (topic === TOPICS.gameflow) return onGameflow(client, event.data);
      if (event.eventType === 'Delete') {
        onLog('Fin de la sélection des champions.');
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

  // Stats can take a while to download: serve the page right away and advise once they land.
  const ready = loadInfo(state.assets.ddragon)
    .then((i) => (info = i ?? {}))
    .then(() => loadStats({ onLog, info }))
    .then((s) => {
      stats = s ?? {};
      const count = (x) => (x ? `${x.version ?? '?'}, ${Object.keys(x.champs ?? {}).length} champions` : 'absentes');
      onLog(`Stats : draft ${count(stats.draft)} · ARAM du Chaos ${count(stats.mayhem)}`);
    })
    .then(() => {
    advise();
    changed();
  });

  connect();

  return {
    ready,
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
