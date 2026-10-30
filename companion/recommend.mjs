// Picks the advice engine that fits the current mode.

import { createDraftModel } from './model-draft.mjs';
import { recommendDraft } from './recommend-draft.mjs';
import { recommendAram } from './recommend-aram.mjs';
import { TIER_NAMES } from './stats-elo.mjs';

const MAYHEM_QUEUES = new Set([2400, 2401, 2403, 2405]);
let draftCache = { stats: null, elo: null, info: null, model: null };

export function recommend(draft, { stats = {}, profile, champions = {}, pickable, owned, info = {}, learning = [] }) {
  if (!draft) return null;
  const names = Object.fromEntries(Object.entries(champions).map(([id, c]) => [id, c.name]));
  if (draft.kind === 'draft' || draft.kind === 'blind') {
    if (!stats.draft) return { options: [], note: 'Chargement des stats de draft...' };
    if (draftCache.stats !== stats.draft || draftCache.elo !== stats.elo || draftCache.info !== info) {
      const difficulty = Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.difficulty]));
      draftCache = { stats: stats.draft, elo: stats.elo, info, model: createDraftModel(stats.draft, { difficulty, info, elo: stats.elo }) };
    }
    const eloLabel = stats.elo ? TIER_NAMES[stats.elo.tier] ?? stats.elo.tier : '';
    return recommendDraft(draft, { stats: stats.draft, model: draftCache.model, profile, pickable, names, learning, eloLabel });
  }
  if (draft.kind === 'aram') {
    const modeStats = MAYHEM_QUEUES.has(draft.queueId) ? stats.mayhem : null;
    return recommendAram(draft, { stats: modeStats, profile, info, names, srStats: stats.draft, owned: owned ?? pickable });
  }
  return { options: [], note: 'Arena : les conseils arrivent dans une prochaine version.' };
}
