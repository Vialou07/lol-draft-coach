// ARAM and ARAM Mayhem advice: keep your champion or take one from the bench.
// Enemies are hidden until loading, so a choice only depends on the champion's strength in
// the mode, your own record with it, and the balance of your team.

import { createDraftModel, sigmoid, toPoints } from './model-draft.mjs';

const N0_MODE = 1000; // pseudo-games pulling a mode winrate towards 50 % [assumption]
const ASSUMED_GAMES = 3000; // the source publishes no sample size [assumption]
const N0_PERSONAL = 40; // a personal record over a few games is mostly noise
const NO_FRONTLINE = -0.08; // logit, about −2 points for a team without any tank [assumption]
const SWITCH_THRESHOLD = 0.01; // advise a bench swap only above one point of win chance
const LABELS = { mode: 'Mode', personal: 'Ton bilan', comp: 'Compo', front: 'Tank' };

let srCache = { stats: null, model: null };

export function recommendAram(draft, { stats, profile, info = {}, names = {}, srStats, owned }) {
  const me = draft.allies.find((p) => p.me);
  if (!me?.championId) return { options: [], note: 'En attente de ton champion...' };
  const queue = String(draft.queueId);
  if (srStats && srCache.stats !== srStats) srCache = { stats: srStats, model: createDraftModel(srStats) };
  const sr = srStats ? srCache.model : null;

  const mode = (key) => {
    const rec = stats?.champs?.[key];
    if (!rec) return { value: 0, variance: 0, games: 0 };
    const g = rec.games ?? ASSUMED_GAMES;
    const p = (rec.wr * g + N0_MODE * 0.5) / (g + N0_MODE);
    return { value: Math.log(p / (1 - p)), variance: 4 / (g + N0_MODE), games: rec.games ?? 0 };
  };
  const personal = (key) => {
    const q = profile?.champions?.[key]?.byQueue?.[queue] ?? { games: 0, wins: 0 };
    return { value: (q.wins - 0.5 * q.games) / (0.25 * q.games + N0_PERSONAL), variance: q.games ? 1 / (0.25 * q.games + N0_PERSONAL) : 0, games: q.games, wins: q.wins };
  };
  // Physical damage share from the champion's main Summoner's Rift role, when available.
  const phys = (key) => {
    if (!sr) return null;
    let best = 0;
    for (let r = 1; r < 5; r++) if (sr.share(key, r) > sr.share(key, best)) best = r;
    return sr.rec(key, best)[4];
  };
  const isFront = (key) => (info[key]?.tags ?? []).includes('Tank') || (info[key]?.defense ?? 0) >= 7;

  const teammates = draft.allies.filter((p) => !p.me && p.championId).map((p) => String(p.championId));
  const comp = (key) => {
    const shares = [...teammates, key].map(phys).filter((x) => x != null);
    const balance = sr && phys(key) != null ? sr.compTerm(shares) - sr.compTerm(shares.slice(0, -1)) : 0;
    const front = teammates.some(isFront) ? 0 : isFront(key) ? -NO_FRONTLINE : 0;
    return { balance, front };
  };

  const base = teammates.reduce((s, k) => s + mode(k).value, 0);
  const score = (key, tag) => {
    const m = mode(key);
    const p = personal(key);
    const c = comp(key);
    const terms = { mode: m.value, personal: p.value, comp: c.balance, front: c.front };
    const total = Object.values(terms).reduce((s, x) => s + x, 0);
    return { key, tag, p: sigmoid(base + total), variance: m.variance + p.variance, terms, games: m.games, personalGames: p.games, personalWins: p.wins };
  };

  const mine = score(String(me.championId), 'Ton champion');
  // The bench only lets you take champions you own. If the list would hide the whole bench,
  // it is probably not what we think it is: show the bench unfiltered.
  const ownedSet = owned?.length ? new Set(owned) : null;
  const usable = ownedSet ? draft.bench.filter((id) => ownedSet.has(id)) : draft.bench;
  const bench = (usable.length ? usable : draft.bench)
    .map((id) => score(String(id), 'Sur le banc'))
    .sort((a, b) => b.p - a.p);
  const swap = bench.length > 0 && bench[0].p - mine.p >= SWITCH_THRESHOLD;
  const all = [mine, ...bench];
  const spread = Math.max(...all.map((x) => x.p)) - Math.min(...all.map((x) => x.p));
  const focus = swap ? bench[0] : mine;
  const team = [...teammates, focus.key];
  const shares = team.map(phys).filter((x) => x != null);
  const analysis = {
    championId: Number(focus.key),
    teams: {
      us: {
        size: team.length,
        physical: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null,
        tanks: team.filter(isFront).length,
        warning: sr ? sr.compWarning(shares) : '',
      },
      them: null,
    },
  };

  const sourceNote = stats?.source
    ? `Stats ${stats.source}${stats.version ? `, patch ${stats.version}` : ''}.`
    : 'Pas de winrates publics pour ce mode : conseil basé sur ta compo et ton bilan perso.';
  return {
    verb: swap ? 'Prends sur le banc' : 'Garde ton champion',
    reference: { championId: Number(mine.key), label: 'ton champion' },
    options: bench.slice(0, 3).map((x) => option(x, mine)),
    current: option(mine, mine),
    analysis,
    flat: spread < 0.005,
    note: spread < 0.005 ? `Rien ne départage ces champions pour l'instant. ${sourceNote}` : sourceNote,
  };
}

function option(s, reference) {
  const half = 1.2816 * Math.sqrt(s.variance) * s.p * (1 - s.p);
  const all = Object.entries(s.terms)
    .map(([k, v]) => ({ label: LABELS[k], delta: toPoints(v, s.p) / 100 }))
    .filter((r) => Math.abs(r.delta) >= 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const reasons = all.filter((r) => Math.abs(r.delta) >= 0.01).slice(0, 2);
  const record = s.personalGames ? ` · ${s.personalWins}/${s.personalGames} pour toi` : '';
  return {
    championId: Number(s.key),
    delta: s.p - reference.p,
    p: s.p,
    low: Math.max(0, s.p - half),
    high: Math.min(1, s.p + half),
    n: s.games,
    reasons,
    detail: all,
    vsId: reference !== s ? Number(reference.key) : null,
    tag: `${s.tag}${record}`,
  };
}
