// ARAM bench shared by the whole team: each champion can only be taken once, so the advice
// is split across players (greedy on the biggest gains), instead of five people chasing the
// same champion. The PC's own player keeps their best choice: the split only shapes the
// advice shown for the allies.

const MIN_GAIN = 0.01;

export function assignBench(views) {
  const offers = [];
  views.forEach((view, i) => {
    for (const o of view.advice?.options ?? []) {
      if (o.delta != null && o.delta >= MIN_GAIN) offers.push({ i, championId: o.championId, gain: o.delta });
    }
  });
  const self = views.findIndex((v) => v.self);
  offers.sort((a, b) => Number(b.i === self) - Number(a.i === self) || b.gain - a.gain);
  const byPlayer = new Map();
  const taken = new Map();
  for (const offer of offers) {
    if (byPlayer.has(offer.i) || taken.has(offer.championId)) continue;
    byPlayer.set(offer.i, offer.championId);
    taken.set(offer.championId, offer.i);
  }
  return views.map((view, i) => {
    if (!view.advice?.options) return view;
    const { analysisFor, ...rest } = view.advice;
    if (i === self) return { ...view, advice: { ...rest, assigned: byPlayer.get(i) ?? null } };
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
      advice: { ...rest, options, verb: mine ? 'Prends' : 'Garde', focus, assigned: mine ?? null, analysis: analysisFor?.[focus] ?? rest.analysis },
    };
  });
}
