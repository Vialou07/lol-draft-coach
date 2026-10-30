// Pick and ban advice for drafts on Summoner's Rift, built on model-draft.mjs.
// Riot allows highlighting choices but not dictating one: we always return several options
// of equal weight, scored as a gap in points against the player's usual champion.

import { ROLE_INDEX, sigmoid, logit, toPoints } from './model-draft.mjs';

const MIN_ROLE_SHARE = 0.03;
const META_FILL = 5; // meta champions added to the player's pool as outside options
const SHOWN = 3;
const LABELS = { meta: 'Méta', lane: 'Lane', cross: 'Matchups', syn: 'Duo', comp: 'Compo', front: 'Tank', mastery: 'Confort' };
const GROUPS = ['Courte', 'Moyenne', 'Longue'];

const phi = (z) => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3))); // normal CDF

export function recommendDraft(draft, { stats, model, profile, pickable, names = {} }) {
  const me = draft.allies.find((p) => p.me);
  if (!me || !stats) return null;
  const myRole = ROLE_INDEX[me.role];
  const taken = new Set(
    [...draft.bans.ally, ...draft.bans.enemy, ...draft.allies.map((p) => p.championId), ...draft.enemies.map((p) => p.championId)].filter(Boolean),
  );
  const allies = draft.allies
    .filter((p) => !p.me && ROLE_INDEX[p.role] != null && (p.championId || p.hoverId))
    .map((p) => ({ key: String(p.championId || p.hoverId), r: ROLE_INDEX[p.role], w: p.championId ? 1 : 0.8 }));
  const enemies = draft.enemies.filter((p) => p.championId).map((p) => String(p.championId));
  const assignments = model.enemyAssignments(enemies);
  // Most likely role of each locked enemy, for placing them on screen.
  const likely = [...assignments].sort((a, b) => b.weight - a.weight)[0];
  const enemyRoles = Object.fromEntries(enemies.map((k, i) => [k, likely?.roles?.[i]]).filter(([, r]) => r != null));
  const ctx = { draft, stats, model, profile, myRole, taken, allies, enemies, assignments, names };
  const base = teamBase(ctx);
  const roleOf = (key) => myRole ?? mainRole(model, key);

  if (draft.myTurn === 'ban') return { ...banAdvice(ctx), enemyRoles };

  if (me.championId) {
    const locked = scoreCandidate(ctx, base, { key: String(me.championId), r: roleOf(String(me.championId)) });
    return { verb: 'Verrouillé', options: [option(locked, null)], reference: null, enemyRoles, analysis: analyze(ctx, locked), note: sourceNote(stats) };
  }

  const owned = pickable?.length ? new Set(pickable.map(String)) : null;
  const all = [];
  for (const key of Object.keys(stats.champs)) {
    if (taken.has(Number(key)) || (owned && !owned.has(key))) continue;
    const r = roleOf(key);
    if (model.share(key, r) < MIN_ROLE_SHARE) continue;
    all.push({ key, r, m: model.mastery(key, profile) });
  }
  const pool = all.filter((c) => c.m.experience >= 1);
  const others = all
    .filter((c) => c.m.experience < 1)
    .sort((a, b) => model.meta(b.key, b.r).value - model.meta(a.key, a.r).value)
    .slice(0, META_FILL);
  const scored = [...pool, ...others].map((c) => scoreCandidate(ctx, base, c)).sort((a, b) => b.p - a.p);
  if (!scored.length) return { verb: '', options: [], note: 'Aucun champion jouable trouvé pour ce rôle.' };

  // Reference: the champion you play most in this role, among those still available.
  const reference = [...scored].sort((a, b) => b.mastery.experience - a.mastery.experience)[0];
  const shown = scored.slice(0, SHOWN);
  const [best] = shown;
  for (const s of shown.slice(1)) {
    const z = (logit(best.p) - logit(s.p)) / Math.sqrt(best.variance + s.variance || 1e-9);
    s.close = phi(z) < 0.75;
  }

  // Your hover in the client is scored too, so you see what you are about to lock.
  const hoverKey = me.hoverId ? String(me.hoverId) : null;
  let hover = null;
  if (hoverKey && stats.champs[hoverKey]) {
    hover = scored.find((s) => s.key === hoverKey) ?? scoreCandidate(ctx, base, { key: hoverKey, r: roleOf(hoverKey) });
  }

  const verb = draft.myTurn === 'pick' ? 'À toi' : draft.phase === 'PLANNING' ? 'Déclare ton pick' : 'Prépare ton pick';
  return {
    verb,
    reference: { championId: Number(reference.key), label: names[reference.key] ?? reference.key },
    options: shown.map((s) => option(s, reference)),
    allClose: shown.length > 1 && shown.slice(1).every((s) => s.close),
    hover: hover ? option(hover, reference) : null,
    enemyRoles,
    // The full draft analysis follows what you are looking at: your hover, else the first choice.
    analysis: analyze(ctx, hover ?? best),
    note: sourceNote(stats),
  };
}

// Full read of the draft around one champion: its lane, its other matchups, its duos, and
// both teams' damage mix, tanks and strength by game length. Values are in points (fraction).
function analyze({ model, allies, enemies, assignments }, s) {
  const pt = (v) => toPoints(v, s.p) / 100;
  const laneOdds = {};
  let laneKnown = 0;
  const cross = {};
  for (const asg of assignments) {
    asg.roles.forEach((re, i) => {
      if (re === s.r) {
        laneOdds[enemies[i]] = (laneOdds[enemies[i]] ?? 0) + asg.weight;
        laneKnown += asg.weight;
      } else {
        cross[enemies[i]] = (cross[enemies[i]] ?? 0) + asg.weight * model.matchup(s.key, s.r, enemies[i], re).value;
      }
    });
  }
  const [opponent, certainty] = Object.entries(laneOdds).sort((a, b) => b[1] - a[1])[0] ?? [];
  const lane = opponent && laneKnown >= 0.5
    ? (() => {
        const m = model.matchup(s.key, s.r, opponent, s.r);
        return { opponentId: Number(opponent), certainty, delta: pt(m.value), games: Math.round(m.games) };
      })()
    : { opponentId: null, worst: s.worst ? { name: s.worst.name, delta: s.worst.pts / 100 } : null };

  const others = Object.entries(cross)
    .map(([k, v]) => ({ championId: Number(k), delta: pt(v) }))
    .filter((x) => Math.abs(x.delta) >= 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  const duos = allies
    .map((a) => {
      const y = model.synergy(s.key, s.r, a.key, a.r);
      return { championId: Number(a.key), delta: pt(y.value), games: Math.round(y.games) };
    })
    .filter((x) => Math.abs(x.delta) >= 0.003)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const ours = [...allies.map((a) => ({ key: a.key, r: a.r })), { key: s.key, r: s.r }];
  const roles = likelyRoles(model, enemies, assignments);
  const theirs = enemies.map((k, i) => ({ key: k, r: roles[i] }));
  const team = (list) => {
    const phys = list.map((c) => model.rec(c.key, c.r)[4]).filter((x) => x != null);
    const time = list.reduce((acc, c) => model.timing(c.key, c.r).map((v, i) => acc[i] + v), [0, 0, 0]);
    return {
      size: list.length,
      physical: phys.length ? phys.reduce((a, b) => a + b, 0) / phys.length : null,
      tanks: list.filter((c) => model.isFront(c.key)).length,
      warning: model.compWarning(phys),
      time,
    };
  };
  const us = team(ours);
  const them = team(theirs);
  const timing = GROUPS.map((label, i) => ({ label, delta: pt(us.time[i] - (theirs.length ? them.time[i] : 0)) }));
  const half = 1.2816 * Math.sqrt(s.variance) * s.p * (1 - s.p);
  return {
    championId: Number(s.key),
    lane,
    others,
    duos,
    teams: { us: { ...us, time: undefined }, them: theirs.length ? { ...them, time: undefined } : null },
    timing: theirs.length || ours.length >= 3 ? timing : null,
    overall: { p: s.p, low: Math.max(0, s.p - half), high: Math.min(1, s.p + half) },
  };
}

function mainRole(model, key) {
  let best = 0;
  for (let r = 1; r < 5; r++) if (model.share(key, r) > model.share(key, best)) best = r;
  return best;
}

// Most likely role of each locked enemy.
function likelyRoles(model, enemies, assignments) {
  const best = [...assignments].sort((a, b) => b.weight - a.weight)[0];
  return enemies.map((k, i) => best?.roles?.[i] ?? mainRole(model, k));
}

// Everything that does not depend on our candidate: the rest of our team against theirs.
function teamBase({ model, allies, enemies, assignments }) {
  let base = 0;
  const allyPhys = allies.map((a) => model.rec(a.key, a.r)[4]).filter((x) => x != null);
  base += model.compTerm(allyPhys) + model.frontTerm(allies.map((a) => a.key));
  const roles = likelyRoles(model, enemies, assignments);
  const enemyPhys = enemies.map((k, i) => model.rec(k, roles[i])[4]).filter((x) => x != null);
  base -= model.compTerm(enemyPhys) + model.frontTerm(enemies);
  for (const a of allies) base += a.w * model.meta(a.key, a.r).value;
  for (let i = 0; i < allies.length; i++) {
    for (let j = i + 1; j < allies.length; j++) {
      base += allies[i].w * allies[j].w * model.synergy(allies[i].key, allies[i].r, allies[j].key, allies[j].r).value;
    }
  }
  for (const asg of assignments) {
    asg.roles.forEach((re, i) => {
      base -= asg.weight * model.meta(enemies[i], re).value;
      for (const a of allies) base += asg.weight * a.w * model.matchup(a.key, a.r, enemies[i], re).value;
      for (let j = i + 1; j < asg.roles.length; j++) base -= asg.weight * model.synergy(enemies[i], re, enemies[j], asg.roles[j]).value;
    });
  }
  return base;
}

function scoreCandidate({ model, profile, allies, enemies, assignments, taken, stats, names }, base, c) {
  const meta = model.meta(c.key, c.r);
  const vars = { meta: meta.variance, lane: 0, cross: 0, syn: 0, comp: 0, mastery: 0 };
  let lane = 0;
  let cross = 0;
  let laneKnown = 0;
  for (const asg of assignments) {
    if (asg.roles.includes(c.r)) laneKnown += asg.weight;
    asg.roles.forEach((re, i) => {
      const m = model.matchup(c.key, c.r, enemies[i], re);
      if (m.lane) {
        lane += asg.weight * m.value;
        vars.lane += asg.weight * m.variance;
      } else {
        cross += asg.weight * m.value;
        vars.cross += asg.weight * m.variance;
      }
    });
  }

  // Lane opponent not picked yet: average over the champions they are likely to play.
  let worst = null;
  if (laneKnown < 0.999) {
    const opponents = Object.keys(stats.champs)
      .filter((k) => !taken.has(Number(k)) && k !== c.key)
      .map((k) => ({ k, w: model.rec(k, c.r)[0] / (model.roleTotals[c.r] / 2 || 1) }))
      .filter((o) => o.w >= 0.005);
    const total = opponents.reduce((s, o) => s + o.w, 0) || 1;
    let blind = 0;
    let blindVar = 0;
    for (const o of opponents) {
      const m = model.matchup(c.key, c.r, o.k, c.r);
      blind += (o.w / total) * m.value;
      blindVar += (o.w / total) * m.variance;
      if (o.w / total >= 0.015 && (!worst || m.value < worst.value)) worst = { key: o.k, value: m.value };
    }
    lane += (1 - laneKnown) * blind;
    vars.lane += (1 - laneKnown) * blindVar;
  }

  let syn = 0;
  for (const a of allies) {
    const y = model.synergy(c.key, c.r, a.key, a.r);
    syn += a.w * y.value;
    vars.syn += a.w * y.variance;
  }
  const phys = allies.map((a) => model.rec(a.key, a.r)[4]).filter((x) => x != null);
  const own = model.rec(c.key, c.r)[4];
  const compWarn = own == null ? '' : model.compWarning([...phys, own]);
  const comp = own == null ? 0 : model.compTerm([...phys, own]) - model.compTerm(phys);
  const keys = allies.map((a) => a.key);
  const front = model.frontTerm([...keys, c.key]) - model.frontTerm(keys);
  const mastery = model.mastery(c.key, profile);

  const terms = { meta: meta.value, lane, cross, syn, comp, front, mastery: mastery.value };
  const total = Object.values(terms).reduce((s, x) => s + x, 0);
  const p = sigmoid(base + total);
  return {
    key: c.key,
    r: c.r,
    p,
    variance: Object.values(vars).reduce((s, x) => s + x, 0),
    vars,
    terms,
    games: meta.games,
    mastery,
    compWarn: compWarn && !model.compWarning(phys) ? compWarn : '',
    worst: laneKnown < 0.5 && worst ? { name: names[worst.key] ?? worst.key, pts: toPoints(worst.value, p) } : null,
  };
}

// A reason is shown only when it is worth at least a point and clearly above its own noise.
// Against a reference champion, each reason is the gap on that criterion, so they explain the
// big number; without one (locked pick, the reference itself) they compare to an average pick.
function reasons(s, ref, max = 2, minPts = 1) {
  const vs = ref && ref !== s ? ref : null;
  return Object.keys(s.terms)
    .map((k) => {
      const v = s.terms[k] - (vs ? vs.terms[k] : 0);
      const variance = (s.vars[k] ?? 0) + (vs ? vs.vars[k] ?? 0 : 0);
      return { k, v, sd: Math.sqrt(variance) };
    })
    .filter(({ v, sd }) => Math.abs(toPoints(v, s.p)) >= minPts && Math.abs(v) >= 1.28 * sd)
    .map(({ k, v }) => ({ label: LABELS[k], delta: toPoints(v, s.p) / 100 }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, max);
}

function option(s, reference) {
  const half = 1.2816 * Math.sqrt(s.variance) * s.p * (1 - s.p);
  const warn = [s.worst && s.worst.pts <= -2.5 ? `Contrable : ${s.worst.name} ${s.worst.pts.toFixed(1).replace('.', ',').replace('-', '−')}` : '', s.compWarn]
    .filter(Boolean)
    .join(' · ');
  return {
    championId: Number(s.key),
    delta: reference ? s.p - reference.p : null,
    p: s.p,
    low: Math.max(0, s.p - half),
    high: Math.min(1, s.p + half),
    n: s.games,
    reasons: reasons(s, null),
    detail: reasons(s, null, 6, 0.5),
    vsId: reference && reference !== s ? Number(reference.key) : null,
    games: s.mastery.games,
    tag: s.mastery.unknown ? '' : s.mastery.experience < 1 ? 'Nouveau' : s.mastery.games ? `${s.mastery.games} parties` : 'Ton pool',
    warn,
    close: Boolean(s.close),
  };
}

function banAdvice({ model, stats, myRole, taken, draft, profile }) {
  // Never suggest banning what an ally has declared or is hovering.
  const excluded = new Set([...(draft.allyBanHovers ?? []), ...draft.allies.map((p) => p.hoverId).filter(Boolean)]);
  const mine = myRole == null
    ? []
    : Object.keys(stats.champs)
        .filter((k) => model.share(k, myRole) >= MIN_ROLE_SHARE && model.mastery(k, profile).experience >= 1)
        .map((k) => ({ k, v: model.meta(k, myRole).value + model.mastery(k, profile).value }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 3);
  const scored = [];
  for (const b of Object.keys(stats.champs)) {
    if (taken.has(Number(b)) || excluded.has(Number(b))) continue;
    let pickRate = 0;
    let threat = 0;
    for (let r = 0; r < 5; r++) {
      const s = model.share(b, r);
      if (s < MIN_ROLE_SHARE) continue;
      pickRate += model.rec(b, r)[0] / (model.roleTotals[r] / 2 || 1);
      let t = model.meta(b, r).value;
      if (r === myRole && mine.length) t -= mine.reduce((acc, c) => acc + model.matchup(c.k, myRole, b, r).value, 0) / mine.length;
      threat += s * t;
    }
    const value = pickRate * threat;
    if (value > 0) scored.push({ key: b, value, pickRate });
  }
  scored.sort((a, b) => b.value - a.value);
  return {
    verb: 'Ton ban',
    reference: null,
    options: scored.slice(0, SHOWN).map((s) => ({
      championId: Number(s.key),
      gain: toPoints(s.value) / 100,
      reasons: [],
      tag: `pris dans ${Math.round(s.pickRate * 100)} % des parties`,
    })),
    note: 'Un ban rapporte peu, en général moins d’un point.',
  };
}

const sourceNote = (stats) => `Stats ${stats.source}, patch ${stats.version}. Chiffres pas encore validés sur de vrais matchs.`;
