// Draft model for Summoner's Rift (ranked and normal draft).
// Every term is a log-odds delta against an average game; small samples are shrunk towards
// neutral with a prior strength measured on the data (study 04, section 3). The weights GAMMA
// are not calibrated on real matches yet, so pairwise terms are deliberately damped.

import { ROLE_INDEX } from './stats-draft.mjs';

const N0_META = 1600;
const N0_LANE = [530, 1190, 730, 1150, 1070]; // same-role matchup, by role
const N0_BOT_SUP = 1480; // bot against the enemy support and the reverse
const N0_CROSS = 2500;
const N0_SYN_BOT_SUP = 1890;
const N0_SYN_OTHER = 5000;
const GAMMA = { meta: 1, lane: 1, cross: 0.5, syn: 0.7, comp: 1 };
const SR_QUEUES = new Set([400, 420, 430, 440, 480, 490, 700]);
const MIN_ROLE_SHARE = 0.03;

const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const toPoints = (d, p = 0.5) => d * p * (1 - p) * 100;

export function createDraftModel(stats, { difficulty = {} } = {}) {
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
    return { value: logit(p) - logit(stats.roleWinrate[r]), variance: 4 / (g30 + N0_META), games: g30 };
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
    if (lo === 0 && hi !== 1) return { value: 0, variance: 0, games: 0 }; // top with mid/bot/support: noise
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
    const d = difficulty[key] ?? 5;
    const A = 0.16 + (0.24 * (Math.min(10, Math.max(1, d)) - 1)) / 9;
    const curve = -A * Math.exp(-experience / 8) + 0.15 * A; // relative to the average player of this champion
    const form = (wins - 0.5 * games) / (0.25 * games + 25);
    return { value: curve + form, variance: games ? 1 / (0.25 * games + 25) : 0, experience, games, wins };
  }

  function compTerm(physShares) {
    if (physShares.length < 4) return 0;
    const s = physShares.reduce((a, b) => a + b, 0) / physShares.length;
    return GAMMA.comp * (-0.8 * Math.max(0, 0.25 - s) - 0.8 * Math.max(0, s - 0.85));
  }

  return { rec, share, roleTotals, meta, matchup, synergy, enemyAssignments, mastery, compTerm, rawLogit };
}

export { ROLE_INDEX, sigmoid, logit };
