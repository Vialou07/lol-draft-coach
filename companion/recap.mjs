// After the game: what each of the ten players did, from the client's own game details (read
// once the game is over). Damage, healing and damage taken are only known at the end: Riot
// does not publish them during the game.

const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';

// Augment names and icons, from the client's game data (ARAM Mayhem shares Arena's list).
export function augmentInfo(list) {
  const out = {};
  for (const a of Array.isArray(list) ? list : []) {
    if (!a?.id) continue;
    const icon = String(a.augmentSmallIconPath ?? '').replace(/^\/lol-game-data\/assets\//i, '').toLowerCase();
    out[a.id] = { name: a.nameTRA || a.augmentNameId || String(a.id), icon: icon ? `${CDRAGON}${icon}` : null, rarity: a.rarity ?? '' };
  }
  return out;
}

export function gameRecap(detail, { puuid, augments = {} } = {}) {
  const ident = detail?.participantIdentities?.find((i) => i.player?.puuid === puuid);
  const me = detail?.participants?.find((p) => p.participantId === ident?.participantId);
  if (!me) return null;
  const who = (p) => detail.participantIdentities.find((i) => i.participantId === p.participantId)?.player ?? {};
  const players = detail.participants.map((p) => {
    const s = p.stats ?? {};
    return {
      id: p.participantId,
      championId: p.championId,
      name: who(p).gameName ?? '',
      puuid: who(p).puuid ?? null,
      ally: p.teamId === me.teamId,
      me: p === me,
      kills: s.kills ?? 0,
      deaths: s.deaths ?? 0,
      assists: s.assists ?? 0,
      damage: s.totalDamageDealtToChampions ?? 0,
      taken: (s.totalDamageTaken ?? 0) + (s.damageSelfMitigated ?? 0),
      heal: s.totalHeal ?? 0,
      gold: s.goldEarned ?? 0,
      cc: s.timeCCingOthers ?? 0,
      items: [s.item0, s.item1, s.item2, s.item3, s.item4, s.item5].filter((x) => x > 0),
      augments: [s.playerAugment1, s.playerAugment2, s.playerAugment3, s.playerAugment4, s.playerAugment5, s.playerAugment6].filter((x) => x > 0),
    };
  });
  const used = new Set(players.flatMap((p) => p.augments));
  return {
    gameId: detail.gameId,
    queueId: detail.queueId,
    mode: detail.gameMode,
    win: Boolean(me.stats?.win),
    duration: detail.gameDuration ?? 0,
    at: detail.gameCreation ?? 0,
    championId: me.championId,
    players,
    augments: Object.fromEntries([...used].filter((id) => augments[id]).map((id) => [id, augments[id]])),
  };
}
