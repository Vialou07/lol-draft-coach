// ARAM bench shared by the group: each champion can only be taken once, so the advice is split
// between you and your friends in the team (greedy on the biggest gains), instead of two of
// you chasing the same champion. Strangers do not see this advice, so nothing is kept for them.
// Every companion of the group computes the same split: same order, no favourite.

import { shownGap } from './recommend-aram.mjs';

const MIN_GAIN = 0.01;

export function assignBench(views) {
  const inGroup = (v) => Boolean(v.self || v.friend);
  const offers = [];
  views.forEach((view, i) => {
    if (!inGroup(view)) return;
    for (const o of view.advice?.options ?? []) {
      if (o.delta != null && shownGap(o.delta) >= MIN_GAIN) offers.push({ i, seat: view.cellId ?? i, championId: o.championId, gain: o.delta });
    }
  });
  offers.sort((a, b) => b.gain - a.gain || a.seat - b.seat);
  const byPlayer = new Map();
  const taken = new Map();
  for (const offer of offers) {
    if (byPlayer.has(offer.i) || taken.has(offer.championId)) continue;
    byPlayer.set(offer.i, offer.championId);
    taken.set(offer.championId, offer.i);
  }
  return views.map((view, i) => {
    if (!view.advice?.options || !inGroup(view)) return view;
    const { analysisFor, ...rest } = view.advice;
    const mine = byPlayer.get(i);
    const focus = mine ?? view.advice.current?.championId;
    const options = view.advice.options
      .map((o) => {
        const owner = taken.get(o.championId);
        return owner != null && owner !== i ? { ...o, takenBy: views[owner].name, tag: `Plutôt pour ${views[owner].name}`, close: false } : { ...o, close: false };
      })
      .sort((a, b) => Number(b.championId === focus) - Number(a.championId === focus) || Number(Boolean(a.takenBy)) - Number(Boolean(b.takenBy)) || b.p - a.p);
    return {
      ...view,
      advice: { ...rest, options, verb: mine ? 'Prends' : 'Garde', focus, assigned: mine ?? null, analysis: analysisFor?.[focus] ?? rest.analysis, analysisFor },
    };
  });
}
