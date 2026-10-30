// Picks the advice engine that fits the current mode.

import { createDraftModel } from './model-draft.mjs';
import { recommendDraft } from './recommend-draft.mjs';
import { recommendAram } from './recommend-aram.mjs';

let draftCache = { stats: null, model: null };

export function recommend(draft, { stats = {}, profile, champions = {}, pickable, info = {} }) {
  if (!draft) return null;
  const names = Object.fromEntries(Object.entries(champions).map(([id, c]) => [id, c.name]));
  if (draft.kind === 'draft' || draft.kind === 'blind') {
    if (!stats.draft) return { options: [], note: 'Chargement des stats de draft...' };
    if (draftCache.stats !== stats.draft) {
      const difficulty = Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.difficulty]));
      draftCache = { stats: stats.draft, model: createDraftModel(stats.draft, { difficulty }) };
    }
    return recommendDraft(draft, { stats: stats.draft, model: draftCache.model, profile, pickable, names });
  }
  if (draft.kind === 'aram') return recommendAram(draft, { stats: stats.aram?.[draft.queueId], profile, info, names, srStats: stats.draft });
  return { options: [], note: 'Arena : les conseils arrivent dans une prochaine version.' };
}
