// Pick and ban advice for drafts on Summoner's Rift, built on model-draft.mjs.

import { ROLE_INDEX, sigmoid, logit, toPoints } from './model-draft.mjs';

const MIN_ROLE_SHARE = 0.03;
const META_FILL = 5; // meta champions added to the player's pool as outside options
const LABELS = { meta: 'Méta', lane: 'Lane', cross: 'Matchups', syn: 'Synergies', comp: 'Compo', mastery: 'Maîtrise' };

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
  const ctx = { draft, stats, model, profile, myRole, taken, allies, enemies, assignments, names };

  const base = teamBase(ctx);
  if (draft.myTurn === 'ban') return banAdvice(ctx, base);

  if (me.championId) {
    const locked = scoreCandidate(ctx, base, { key: String(me.championId), r: myRole ?? mainRole(model, String(me.championId)) });
    return { verb: 'Ta chance avec', options: [option(ctx, locked)], note: sourceNote(stats) };
  }

  const owned = pickable?.length ? new Set(pickable.map(String)) : null;
  const all = [];
  for (const key of Object.keys(stats.champs)) {
    if (taken.has(Number(key)) || (owned && !owned.has(key))) continue;
    const r = myRole ?? mainRole(model, key);
    if (model.share(key, r) < MIN_ROLE_SHARE) continue;
    all.push({ key, r, m: model.mastery(key, profile) });
  }
  const pool = all.filter((c) => c.m.experience >= 2);
  const others = all
    .filter((c) => c.m.experience < 2)
    .sort((a, b) => model.meta(b.key, b.r).value - model.meta(a.key, a.r).value)
    .slice(0, META_FILL);
  const scored = [...pool, ...others].map((c) => scoreCandidate(ctx, base, c)).sort((a, b) => b.p - a.p);
  if (!scored.length) return { verb: '', options: [], note: 'Aucun champion jouable trouvé pour ce rôle.' };

  const [best] = scored;
  for (const s of scored.slice(1)) {
    const z = (logit(best.p) - logit(s.p)) / Math.sqrt(best.variance + s.variance);
    s.close = phi(z) < 0.75;
  }
  const verb = draft.myTurn === 'pick' ? 'Pick conseillé' : draft.phase === 'PLANNING' ? 'À annoncer' : 'À préparer';
  return { verb, options: scored.slice(0, 4).map((s) => option(ctx, s)), note: sourceNote(stats) };
}

function mainRole(model, key) {
  let best = 0;
  for (let r = 1; r < 5; r++) if (model.share(key, r) > model.share(key, best)) best = r;
  return best;
}

// Everything that does not depend on our candidate: the rest of our team against theirs.
function teamBase({ model, allies, enemies, assignments }) {
  let base = 0;
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

function scoreCandidate({ model, profile, allies, enemies, assignments, taken, stats }, base, c) {
  const meta = model.meta(c.key, c.r);
  let lane = 0;
  let laneVar = 0;
  let cross = 0;
  let crossVar = 0;
  let laneKnown = 0;
  for (const asg of assignments) {
    if (asg.roles.includes(c.r)) laneKnown += asg.weight;
    asg.roles.forEach((re, i) => {
      const m = model.matchup(c.key, c.r, enemies[i], re);
      if (m.lane) {
        lane += asg.weight * m.value;
        laneVar += asg.weight * m.variance;
      } else {
        cross += asg.weight * m.value;
        crossVar += asg.weight * m.variance;
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
    laneVar += (1 - laneKnown) * blindVar;
  }

  let syn = 0;
  let synVar = 0;
  for (const a of allies) {
    const y = model.synergy(c.key, c.r, a.key, a.r);
    syn += a.w * y.value;
    synVar += a.w * y.variance;
  }
  const phys = allies.map((a) => model.rec(a.key, a.r)[4]).filter((x) => x != null);
  const own = model.rec(c.key, c.r)[4];
  const comp = own == null ? 0 : model.compTerm([...phys, own]) - model.compTerm(phys);
  const mastery = model.mastery(c.key, profile);

  const terms = { meta: meta.value, lane, cross, syn, comp, mastery: mastery.value };
  const total = Object.values(terms).reduce((s, x) => s + x, 0);
  const p = sigmoid(base + total);
  return {
    key: c.key,
    p,
    variance: meta.variance + laneVar + crossVar + synVar + mastery.variance,
    terms,
    games: meta.games,
    mastery,
    worst: laneKnown < 0.5 ? worst : null,
  };
}

function option({ names }, s) {
  const half = 1.2816 * Math.sqrt(s.variance) * s.p * (1 - s.p);
  const reasons = Object.entries(s.terms)
    .map(([k, v]) => ({ label: LABELS[k], delta: toPoints(v, s.p) / 100 }))
    .filter((r) => Math.abs(r.delta) >= 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  const worstPts = s.worst ? toPoints(s.worst.value, s.p) : 0;
  return {
    championId: Number(s.key),
    p: s.p,
    low: Math.max(0, s.p - half),
    high: Math.min(1, s.p + half),
    n: s.games,
    reasons,
    tag: s.mastery.games > 0 ? `${s.mastery.games} games récentes` : s.mastery.experience >= 2 ? 'Ton pool' : 'Nouveau pour toi',
    warn: worstPts <= -2.5 ? `Contrable : ${names[s.worst.key] ?? s.worst.key} ${worstPts.toFixed(1).replace('.', ',').replace('-', '−')} pt` : '',
    close: Boolean(s.close),
  };
}

function banAdvice({ model, stats, myRole, taken, draft, allies, enemies, assignments, profile, names }, base) {
  const hovered = new Set(draft.allyBanHovers ?? []);
  // Our likely picks: the player's best pool champions for their role.
  const mine = myRole == null
    ? []
    : Object.keys(stats.champs)
        .filter((k) => model.share(k, myRole) >= MIN_ROLE_SHARE && model.mastery(k, profile).experience >= 2)
        .map((k) => ({ k, v: model.meta(k, myRole).value + model.mastery(k, profile).value }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 3);
  const scored = [];
  for (const b of Object.keys(stats.champs)) {
    if (taken.has(Number(b)) || hovered.has(Number(b))) continue;
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
    verb: 'Ban conseillé',
    options: scored.slice(0, 3).map((s) => ({
      championId: Number(s.key),
      gain: toPoints(s.value) / 100,
      reasons: [],
      tag: `pris dans ${Math.round(s.pickRate * 100)} % des games`,
    })),
    note: 'Un ban rapporte peu : moins d’un point en général.',
  };
}

const sourceNote = (stats) => `Stats ${stats.source}, patch ${stats.version}. Modèle pas encore calé sur de vrais matchs.`;
