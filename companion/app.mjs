// The companion: follows the League client, decodes champ select and serves the live page.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { findClient, get, getBinary, tryGet, subscribe, TOPICS } from './lcu.mjs';
import { draftState, draftKey } from './draft.mjs';
import { startServer } from './server.mjs';
import { buildProfile } from './profile.mjs';
import { recommend } from './recommend.mjs';
import { loadDraftStats } from './stats-draft.mjs';
import { loadMayhemStats } from './stats-aram.mjs';
import { loadChampionInfo } from './static-data.mjs';
import { loadGroup, groupLink, playerIdFor, startRelay } from './relay.mjs';
import { assignBench } from './team.mjs';

const RETRY_MS = 3000;
const SETTINGS = new URL('../data/local/settings.json', import.meta.url);
// Demos replay real recorded champ selects (anonymised fixtures) so the page can be seen
// without starting a game.
const DEMOS = {
  ranked: { file: 'q420-2026-10-24-03.json', queue: { id: 420, gameMode: 'CLASSIC', name: 'Classée solo/duo' } },
  aram: { file: 'q2400-2026-10-24-40.json', queue: { id: 2400, gameMode: 'KIWI', name: 'ARAM du Chaos' } },
};
const DEMO_SPEED = 1.5;
// With the client closed the demo has no personal data, which would rate every champion as
// never played: a sample support pool stands in, and the page says so.
const SAMPLE_PROFILE = {
  champions: {
    267: { byQueue: { 420: { games: 30, wins: 16 } } }, // Nami
    43: { byQueue: { 420: { games: 20, wins: 10 } } }, // Karma
    117: { byQueue: { 420: { games: 12, wins: 6 } } }, // Lulu
    412: { byQueue: { 420: { games: 8, wins: 4 } } }, // Thresh
    89: { byQueue: { 420: { games: 4, wins: 2 } } }, // Leona
  },
};
const CAPTIONS = {
  ban: 'Ton ban : les 3 champions qui menacent le plus ton équipe. Un ban change peu le résultat.',
  pick: 'À toi : tes 3 meilleurs choix. Le gros chiffre = ta chance de gagner avec ce champion. Touche une carte pour voir pourquoi.',
  locked: 'Verrouillé : ta chance avec ce champion, et ce qui pèse dans un sens ou dans l’autre.',
  aram: 'Le banc est rempli : chaque champion du banc que tu possèdes, comparé à ton champion actuel.',
};

// Moments where the demo stops and explains, until the viewer taps « Continuer ».
function keyMoment(prev, d) {
  const me = d.allies.find((p) => p.me);
  const before = prev?.allies.find((p) => p.me);
  if (d.kind === 'aram') return d.phase === 'FINALIZATION' && prev?.phase !== 'FINALIZATION' ? 'aram' : null;
  if (d.myTurn === 'ban' && prev?.myTurn !== 'ban') return 'ban';
  if (d.myTurn === 'pick' && prev?.myTurn !== 'pick') return 'pick';
  if (me?.championId && !before?.championId) return 'locked';
  return null;
}
const DDRAGON_FALLBACK = '16.21.1';
const ROLE_LABELS = { top: 'top', jungle: 'jungle', middle: 'mid', bottom: 'ADC', utility: 'support' };

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

export async function startCompanion({ port = 4317, host, lockfile, onLog = () => {}, loadStats = defaultStats, loadInfo = loadChampionInfo, share = true } = {}) {
  const state = {
    status: 'no-client',
    gameflow: 'None',
    summoner: null,
    queue: null,
    draft: null,
    advice: null,
    champions: {},
    assets: { ddragon: await latestDdragon() },
    settings: await readFile(SETTINGS, 'utf8').then(JSON.parse).catch(() => ({ learning: [] })),
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
  let owned = null;
  let ws = null;
  let retry = null;
  let stopped = false;
  let lastDraftKey = '';

  let demo = null;
  let rawSession = null; // last champ select payload, to compute each ally's own advice
  let aramViews = null; // ARAM: the whole team's views, with the shared bench split between players
  const friendProfiles = new Map();

  // Group sharing: friends follow their own draft on their phone through the group link.
  const group = share ? await loadGroup().catch(() => null) : null;
  const relay = group ? await startRelay({ group, onLog }).catch(() => null) : null;
  if (group) state.group = { link: groupLink(group) };

  const server = await startServer({
    port,
    host,
    snapshot: () => state,
    icon,
    actions: {
      '/demo/ranked': () => startDemo('ranked'),
      '/demo/aram': () => startDemo('aram'),
      '/demo/stop': () => stopDemo(),
      '/settings': async (input) => {
        const learning = Array.isArray(input?.learning) ? [...new Set(input.learning.map(Number).filter((id) => id > 0))].slice(0, 12) : state.settings.learning;
        state.settings = { ...state.settings, learning };
        await mkdir(new URL('./', SETTINGS), { recursive: true });
        await writeFile(SETTINGS, JSON.stringify(state.settings, null, 2));
        advise();
        changed();
        return state.settings;
      },
      '/demo/next': () => {
        demo?.resume?.();
        return {};
      },
    },
  });
  // Advice from each ally's seat, computed from the same champ select (they see it too).
  const allyViews = () => {
    if (!rawSession || !state.draft) return [];
    const gameMode = state.queue?.gameMode;
    return (rawSession.myTeam ?? [])
      .filter((p) => p.cellId !== rawSession.localPlayerCellId)
      .map((p) => {
        const draft = draftState({ ...rawSession, localPlayerCellId: p.cellId }, { gameMode });
        const visible = p.nameVisibilityType !== 'HIDDEN' && p.gameName;
        const known = visible && p.puuid ? friendProfiles.get(p.puuid) : null;
        let advice = null;
        try {
          advice = recommend(draft, { stats, profile: known ?? { unknown: true }, champions: state.champions, info });
        } catch {
          // one ally's view must not break the others
        }
        const name = visible ? p.gameName : p.anonName ?? `Allié ${ROLE_LABELS[p.assignedPosition] ?? ''}`.trim();
        return { cellId: p.cellId, name, self: false, draft, advice };
      });
  };

  // What the group's phones receive: no lockfile, no token, only champions, drafts and advice.
  const groupMessage = () => {
    const views = state.status !== 'champ-select' || !state.draft
      ? []
      : aramViews ?? [{ cellId: state.draft.allies.find((p) => p.me)?.cellId, name: state.summoner?.gameName ?? 'Moi', self: true, draft: state.draft, advice: state.advice }, ...allyViews()];
    const ids = new Set();
    JSON.stringify(views, (k, v) => {
      if (/^(championId|hoverId|opponentId|vsId)$/.test(k) && v > 0) ids.add(String(v));
      if (k === 'bench' || k === 'ally' || k === 'enemy') v?.forEach?.((id) => ids.add(String(id)));
      return v;
    });
    return {
      v: 1,
      name: state.summoner?.gameName ?? 'PC de l’hôte',
      status: state.status,
      gameflow: state.gameflow,
      queue: state.queue,
      demo: state.demo ? { name: state.demo.name, caption: state.demo.caption } : null,
      assets: state.assets,
      champions: Object.fromEntries([...ids].filter((id) => state.champions[id]).map((id) => [id, state.champions[id]])),
      views,
    };
  };

  const changed = () => {
    state.updatedAt = Date.now();
    server.broadcast();
    if (relay) relay.publish(playerIdFor(state.summoner ? `${state.summoner.gameName}#${state.summoner.tagLine}` : `host-${group.id}`), groupMessage);
  };

  const advise = () => {
    if (!state.draft) return;
    try {
      const who = demo ? profile ?? SAMPLE_PROFILE : profile;
      state.advice = recommend(state.draft, { stats, profile: who, champions: state.champions, pickable, owned, info, learning: state.settings.learning });
      aramViews = null;
      if (state.draft.kind === 'aram' && rawSession) {
        const own = { cellId: state.draft.allies.find((p) => p.me)?.cellId, name: state.summoner?.gameName ?? 'Moi', self: true, draft: state.draft, advice: state.advice };
        aramViews = assignBench([own, ...allyViews()]);
        state.advice = aramViews[0].advice;
      }
    } catch (e) {
      onLog(`Erreur de calcul : ${e.message}`);
      state.advice = { options: [], note: 'Conseil indisponible pour ce moment de la draft.' };
    }
  };

  const stopDemo = () => {
    if (!demo) return {};
    demo.cancelled = true;
    demo.resume?.();
    demo = null;
    Object.assign(state, { demo: null, draft: null, advice: null, queue: null, status: client ? 'connected' : 'no-client' });
    lastDraftKey = '';
    changed();
    return {};
  };

  const startDemo = async (name) => {
    if (state.status === 'champ-select' && !demo) return { error: 'Une vraie sélection est en cours.' };
    if (demo) {
      demo.cancelled = true;
      demo.resume?.();
    }
    const run = (demo = { name, cancelled: false, resume: null });
    const spec = DEMOS[name];
    const fixture = JSON.parse(await readFile(new URL(`../test/fixtures/real/${spec.file}`, import.meta.url), 'utf8'));
    Object.assign(state, { demo: { name, profile: profile ? 'real' : 'sample', caption: null }, queue: spec.queue, status: 'champ-select' });
    lastDraftKey = '';
    (async () => {
      let prev = fixture.events[0].t;
      for (const e of fixture.events) {
        await new Promise((r) => setTimeout(r, Math.min(4000, Math.max(300, (e.t - prev) / DEMO_SPEED))));
        prev = e.t;
        if (run.cancelled) return;
        const prevDraft = state.draft;
        rawSession = e.session;
        state.draft = draftState(e.session, { gameMode: spec.queue.gameMode });
        if (state.draft.timeLeftMs != null) state.draft.timeLeftMs /= DEMO_SPEED;
        if (state.draft.phaseTotalMs != null) state.draft.phaseTotalMs /= DEMO_SPEED;
        advise();
        const moment = keyMoment(prevDraft, state.draft);
        if (moment) {
          // Freeze the timer while the viewer reads.
          state.draft.timeLeftMs = null;
          state.demo = { ...state.demo, caption: CAPTIONS[moment] };
          changed();
          await new Promise((r) => (run.resume = r));
          if (run.cancelled) return;
          state.demo = { ...state.demo, caption: null };
        }
        changed();
      }
      await new Promise((r) => setTimeout(r, 8000));
      if (!run.cancelled) stopDemo();
    })();
    return { ok: true };
  };

  const onSession = (session) => {
    if (demo) stopDemo(); // a real champ select always wins over a demo
    const fresh = state.status !== 'champ-select';
    rawSession = session;
    state.draft = draftState(session, { gameMode: state.queue?.gameMode });
    const key = draftKey(state.draft);
    if (key === lastDraftKey) return changed(); // timer only
    lastDraftKey = key;
    state.status = 'champ-select';
    if (fresh) {
      pickable = null;
      // Friends visible in the lobby: read their profile as the client shows it, once.
      for (const p of session.myTeam ?? []) {
        if (p.cellId === session.localPlayerCellId || p.nameVisibilityType === 'HIDDEN' || !p.puuid || friendProfiles.has(p.puuid)) continue;
        friendProfiles.set(p.puuid, null);
        buildProfile(client, { puuid: p.puuid, maxGames: 60 })
          .then((prof) => {
            friendProfiles.set(p.puuid, prof);
            onLog(`Profil de ${p.gameName} : ${prof.gamesRead} parties lues`);
            changed();
          })
          .catch(() => friendProfiles.delete(p.puuid));
      }
      const me = state.draft.allies.find((p) => p.me);
      onLog(`Sélection : file ${state.draft.queueId} (${state.queue?.gameMode ?? '?'}), mode ${state.draft.kind}, rôle ${me?.role || '-'}`);
      tryGet(client, '/lol-champ-select/v1/pickable-champion-ids').then((ids) => {
        onLog(`Champions jouables : ${Array.isArray(ids) ? ids.length : 'indisponible'}`);
        if (!Array.isArray(ids) || state.status !== 'champ-select') return;
        pickable = ids;
        advise();
        changed();
      });
      tryGet(client, '/lol-champions/v1/owned-champions-minimal').then((list) => {
        const ids = Array.isArray(list) ? list.filter((c) => c.ownership?.owned || c.ownership?.freeToPlay || c.freeToPlay).map((c) => c.id) : null;
        onLog(`Champions possédés : ${ids ? ids.length : 'indisponible'}`);
        if (!ids?.length || state.status !== 'champ-select') return;
        owned = ids;
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
    if (demo && phase !== 'ChampSelect') return changed();
    if (demo) stopDemo();
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
    .then((i) => {
      info = i ?? {};
      // Without the client (demo), names and pictures come from Data Dragon.
      if (!Object.keys(state.champions).length) {
        state.champions = Object.fromEntries(Object.entries(info).map(([key, c]) => [key, { name: c.name, alias: c.id }]));
      }
    })
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
      await relay?.stop();
      await server.close();
    },
  };
}
