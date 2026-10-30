// Draft model for Summoner's Rift (ranked and normal draft).
// Every term is a log-odds delta against an average game; small samples are shrunk towards
// neutral with a prior strength measured on the data (study 04, section 3). The weights GAMMA
// are not calibrated on real matches yet, so pairwise terms are deliberately damped.

import { ROLE_INDEX } from './stats-draft.mjs';
import { isEngage, isPeel, isFrontline } from './static-attrs.mjs';

// Prior strengths from study 07: a champion's patch winrate is pulled hard towards its
// 30-day winrate (n0 15 000 for an unchanged champion), lane matchups less so.
const N0_META = 15000;
const N0_LANE = [480, 1100, 600, 1300, 1000]; // same-role matchup, by role
const N0_BOT_SUP = 1480; // bot against the enemy support and the reverse
const N0_CROSS = 2500;
const N0_SYN_BOT_SUP = 1890;
const N0_SYN_OTHER = 5000;
// Every pair of the draft counts (25 ally-enemy matchups, the allied duos), with prior
// strengths measured on the data. Pairwise effects overlap, so the weights below damp the
// off-lane terms until a backtest calibrates them.
const GAMMA = { meta: 1, lane: 1, cross: 0.5, syn: 0.6, comp: 1 };
const NO_FRONTLINE = -0.06; // logit, about −1.5 point for a team without any tank [assumption]
const N0_TIME = 2000; // pseudo-games pulling a game-length winrate towards the champion's average
const N0_ELO = 3000; // pseudo-games pulling the winrate at your elo towards the Emerald+ one
const SR_QUEUES = new Set([400, 420, 430, 440, 480, 490, 700]);
const MIN_ROLE_SHARE = 0.03;

const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const toPoints = (d, p = 0.5) => d * p * (1 - p) * 100;

export function createDraftModel(stats, { difficulty = {}, info = {}, elo = null } = {}) {
  const rec = (key, r) => stats.champs[key]?.roles?.[r] ?? [0, 0, 0, 0, null];
  const games30 = (key) => (stats.champs[key]?.roles ?? []).reduce((s, x) => s + x[0], 0);
  const share = (key, r) => {
    const total = games30(key);
    return total ? rec(key, r)[0] / total : 0;
  };
  const roleTotals = [0, 1, 2, 3, 4].map((r) => Object.keys(stats.champs).reduce((s, k) => s + rec(k, r)[0], 0));
  const rawLogit = (key, r) => {
    const [g, w] = rec(key, r);
    return logit((w + 1) / (g + 2));
  };

  function meta(key, r) {
    const [g30, w30, gp, wp] = rec(key, r);
    const prior = (w30 + 1) / (g30 + 2);
    const p = (wp + N0_META * prior) / (gp + N0_META);
    const [ge, we] = elo?.champs?.[key]?.[r] ?? [0, 0];
    if (!elo || !ge) return { value: logit(p) - logit(stats.roleWinrate[r]), variance: 4 / (g30 + N0_META), games: g30 };
    // At your elo: the bracket's own winrate, pulled towards Emerald+ when it has few games.
    const pe = (we + N0_ELO * p) / (ge + N0_ELO);
    return { value: logit(pe) - logit(elo.roleWinrate[r]), variance: 4 / (ge + N0_ELO), games: ge };
  }

  // Record of `a` against or with `b`, averaged over both points of view.
  function pairRecord(table, a, ra, b, rb, against) {
    const ab = stats[table][`${a}:${ra}`]?.[`${rb}:${b}`];
    const ba = stats[table][`${b}:${rb}`]?.[`${ra}:${a}`];
    let g = 0;
    let w = 0;
    let n = 0;
    if (ab) {
      g += ab[0];
      w += ab[1];
      n++;
    }
    if (ba) {
      g += ba[0];
      w += against ? ba[0] - ba[1] : ba[1];
      n++;
    }
    return n ? { g: g / n, w: w / n } : { g: 0, w: 0 };
  }

  function matchup(c, r, e, re) {
    const n0 = r === re ? N0_LANE[r] : (r === 3 && re === 4) || (r === 4 && re === 3) ? N0_BOT_SUP : N0_CROSS;
    const gamma = r === re || n0 === N0_BOT_SUP ? GAMMA.lane : GAMMA.cross;
    const expected = sigmoid(rawLogit(c, r) - rawLogit(e, re));
    const { g, w } = pairRecord('mu', c, r, e, re, true);
    const value = logit((w + n0 * expected) / (g + n0)) - logit(expected);
    return { value: gamma * value, variance: (gamma * gamma * 4) / (g + n0), games: g, lane: r === re };
  }

  function synergy(c, r, a, ra) {
    const [lo, hi] = r < ra ? [r, ra] : [ra, r];
    if (lo === 0 && hi !== 1) return { value: 0, variance: 0, games: 0 }; // top with mid/bot/support: noise (study 04)
    const n0 = lo === 3 && hi === 4 ? N0_SYN_BOT_SUP : N0_SYN_OTHER;
    const expected = sigmoid(rawLogit(c, r) + rawLogit(a, ra));
    const { g, w } = pairRecord('sy', c, r, a, ra, false);
    const value = logit((w + n0 * expected) / (g + n0)) - logit(expected);
    return { value: GAMMA.syn * value, variance: (GAMMA.syn * GAMMA.syn * 4) / (g + n0), games: g };
  }

  // Enemy roles are hidden: enumerate role assignments weighted by each champion's role shares.
  function enemyAssignments(enemyKeys) {
    const out = [];
    const walk = (i, used, roles, weight) => {
      if (weight === 0) return;
      if (i === enemyKeys.length) return out.push({ roles: [...roles], weight });
      for (let r = 0; r < 5; r++) {
        if (used & (1 << r)) continue;
        const s = share(enemyKeys[i], r) || 0.001;
        roles.push(r);
        walk(i + 1, used | (1 << r), roles, weight * s);
        roles.pop();
      }
    };
    walk(0, 0, [], 1);
    const total = out.reduce((s, a) => s + a.weight, 0) || 1;
    for (const a of out) a.weight /= total;
    return out.length ? out : [{ roles: [], weight: 1 }];
  }

  function mastery(key, profile) {
    if (profile?.unknown) return { value: 0, variance: 0, experience: 10, games: 0, wins: 0, unknown: true };
    const p = profile?.champions?.[key];
    let games = 0;
    let wins = 0;
    for (const [q, rec] of Object.entries(p?.byQueue ?? {})) {
      if (!SR_QUEUES.has(Number(q))) continue;
      games += rec.games;
      wins += rec.wins;
    }
    // Post-14.10 mastery points: roughly 1000 per game [assumption, to calibrate].
    const experience = Math.max(games, (p?.mastery ?? 0) / 1000);
    // Fixed steps (study 07): about −6 points never played, −3 points under 10 games.
    // A personal winrate over a few dozen games is noise, so it is not used.
    const value = experience < 1 ? -0.24 : experience < 10 ? -0.12 : 0;
    return { value, variance: 0, experience, games, wins };
  }

  function compTerm(physShares) {
    if (physShares.length < 4) return 0;
    const s = physShares.reduce((a, b) => a + b, 0) / physShares.length;
    return GAMMA.comp * (-0.8 * Math.max(0, 0.25 - s) - 0.8 * Math.max(0, s - 0.85));
  }

  const attrs = (key) => info[key]?.attrs;
  const isFront = (key) => (attrs(key) ? isFrontline(attrs(key)) : false) || (info[key]?.tags ?? []).includes('Tank') || (info[key]?.defense ?? 0) >= 7;
  const engage = (key) => isEngage(attrs(key));
  const peel = (key) => isPeel(attrs(key));

  // A team of four or five without any tank pays a small price.
  function frontTerm(teamKeys) {
    if (teamKeys.length < 4) return 0;
    return teamKeys.some(isFront) ? 0 : NO_FRONTLINE;
  }

  // Winrate by game length, as log-odds deviations from the champion's average:
  // [short games, medium, long]. Positive = stronger when the game lasts that long.
  function timing(key, r) {
    const [g, w, , , , byTime = []] = rec(key, r);
    if (!g || byTime.length < 5) return [0, 0, 0];
    const avg = w / g;
    const dev = ([bg, bw]) => logit((bw + N0_TIME * avg) / (bg + N0_TIME)) - logit(avg);
    const merge = (list) => list.reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    return [dev(merge(byTime.slice(0, 2))), dev(byTime[2]), dev(merge(byTime.slice(3)))];
  }

  // Flags an unbalanced damage mix in words.
  function compWarning(physShares) {
    if (physShares.length < 4) return '';
    const s = physShares.reduce((a, b) => a + b, 0) / physShares.length;
    return s < 0.2 ? 'Équipe presque full AP' : s > 0.85 ? 'Équipe presque full AD' : '';
  }

  return { rec, share, roleTotals, meta, matchup, synergy, enemyAssignments, mastery, compTerm, compWarning, frontTerm, isFront, engage, peel, attrs, timing, rawLogit };
}

export { ROLE_INDEX, sigmoid, logit };
