// ARAM and ARAM Mayhem advice: keep your champion or take one from the bench.
// Enemies are hidden until loading. The number shown is the champion's winrate in the mode, as
// the source publishes it, and the advice follows it alone: a swap only for at least a point.
// What a champion brings to your team (the missing tank, the other damage type) is written
// next to it, never mixed into the number. The source's tiers weigh popularity (tier C goes up
// to 54 %, tier A down to 49 %), so they are not shown next to a winrate they contradict.
// Your own record is left out: the client only keeps your last 20 games.

import { createDraftModel, sigmoid } from './model-draft.mjs';

const N0_MODE = 1000; // pseudo-games pulling a counted mode winrate towards 50 % [assumption]
const SWITCH_THRESHOLD = 0.01; // advise a bench swap only from one point of winrate
// Gaps are compared as the page shows them, to a tenth of a point: "+1,0 pt" is one point.
export const shownGap = (x) => Math.round(x * 1000) / 1000;
const PHYSICAL_TEAM = 0.7; // average physical share above which a team lacks magic damage

let srCache = { stats: null, model: null };

export function recommendAram(draft, { stats, info = {}, srStats, owned }) {
  const me = draft.allies.find((p) => p.me);
  if (!me?.championId) return { options: [], note: 'En attente de ton champion...' };
  if (srStats && srCache.stats !== srStats) srCache = { stats: srStats, model: createDraftModel(srStats) };
  const sr = srStats ? srCache.model : null;

  // Winrates without a sample size come from very large samples (a whole server): used as they
  // are, so the number matches the tier list. Counted samples are pulled towards 50 %.
  const mode = (key) => {
    const rec = stats?.champs?.[key];
    if (!rec) return { value: 0, variance: 0, games: 0 };
    const p = rec.games ? (rec.wr * rec.games + N0_MODE * 0.5) / (rec.games + N0_MODE) : rec.wr;
    // Without a published sample size there is no honest range to draw.
    return { value: Math.log(p / (1 - p)), variance: rec.games ? 4 / (rec.games + N0_MODE) : 0, games: rec.games ?? 0 };
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
  // What a champion would bring that the team lacks, in words.
  const teamPhys = teammates.map(phys).filter((x) => x != null);
  const avgPhys = teamPhys.length >= 3 ? teamPhys.reduce((a, b) => a + b, 0) / teamPhys.length : null;
  const brings = (key) => {
    const out = [];
    if (teammates.length >= 2 && !teammates.some(isFront) && isFront(key)) out.push('le tank qui vous manque');
    const own = phys(key);
    if (avgPhys != null && own != null) {
      if (avgPhys > PHYSICAL_TEAM && own < 0.4) out.push('l’AP qui vous manque');
      if (avgPhys < 1 - PHYSICAL_TEAM && own > 0.6) out.push('l’AD qui vous manque');
    }
    return out;
  };

  const score = (key, tag) => {
    const m = mode(key);
    return { key, tag, p: sigmoid(m.value), variance: m.variance, games: m.games, brings: brings(key) };
  };

  const mine = { ...score(String(me.championId), 'Ton champion'), mine: true };
  // The bench only lets you take champions you own. If the list would hide the whole bench,
  // it is probably not what we think it is: show the bench unfiltered.
  const ownedSet = owned?.length ? new Set(owned) : null;
  const usable = ownedSet ? draft.bench.filter((id) => ownedSet.has(id)) : draft.bench;
  const bench = (usable.length ? usable : draft.bench)
    .map((id) => score(String(id), 'Banc'))
    .sort((a, b) => b.p - a.p);
  const swap = Boolean(stats) && bench.length > 0 && shownGap(bench[0].p - mine.p) >= SWITCH_THRESHOLD;
  const focus = swap ? bench[0] : mine;
  const all = [mine, ...bench];
  // One ranking: your champion and the whole bench, by winrate in the mode.
  const shown = [...all].sort((a, b) => b.p - a.p);
  const spread = Math.max(...all.map((x) => x.p)) - Math.min(...all.map((x) => x.p));
  // Our team's make-up with a given champion in my seat (the team split may change who I take).
  const analysisWith = (key) => {
    const team = [...teammates, key];
    const shares = team.map(phys).filter((x) => x != null);
    return {
      championId: Number(key),
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
  };
  const analysisFor = Object.fromEntries(all.map((x) => [x.key, analysisWith(x.key)]));
  const analysis = analysisFor[focus.key];

  const sourceNote = stats?.source
    ? `Stats ${stats.source}${stats.version ? `, patch ${stats.version}` : ''}.`
    : 'Pas de winrates publics pour ce mode : rien ne départage ces champions.';
  return {
    verb: swap ? 'Prends' : 'Garde',
    focus: Number(focus.key),
    reference: { championId: Number(mine.key), label: 'ton champion' },
    options: shown.map((x) => option(x, mine)),
    current: option(mine, mine),
    analysis,
    analysisFor,
    flat: !stats || spread < 0.005,
    note: !stats || spread >= 0.005 ? sourceNote : `Rien ne départage ces champions pour l'instant. ${sourceNote}`,
  };
}

function option(s, reference) {
  const half = 1.2816 * Math.sqrt(s.variance) * s.p * (1 - s.p);
  return {
    championId: Number(s.key),
    delta: s.p - reference.p,
    p: s.p,
    low: Math.max(0, s.p - half),
    high: Math.min(1, s.p + half),
    n: s.games,
    vsId: reference !== s ? Number(reference.key) : null,
    tag: s.tag,
    brings: s.brings,
    mine: Boolean(s.mine),
  };
}
