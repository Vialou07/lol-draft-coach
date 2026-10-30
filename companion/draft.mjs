// Turns a /lol-champ-select/v1/session payload into the state the app shows and scores.
// Only what the client shows the player is used. In particular an enemy pick counts once it
// is locked: in-progress enemy actions can carry the enemy's hover, which the game hides.

const ROLES = { top: 'top', jungle: 'jungle', middle: 'mid', bottom: 'bot', utility: 'support' };
const ARENA_QUEUES = new Set([1700, 1710, 1750]);

export function gameKind(session, gameMode = '') {
  if (gameMode === 'CHERRY' || ARENA_QUEUES.has(session.queueId)) return 'arena';
  if (session.benchEnabled) return 'aram';
  const hasBans = (session.actions ?? []).flat().some((a) => a.type === 'ban');
  return hasBans ? 'draft' : 'blind';
}

export function draftState(session, { gameMode = '' } = {}) {
  const kind = gameKind(session, gameMode);
  const myCell = session.localPlayerCellId;
  const allyCells = new Set((session.myTeam ?? []).map((p) => p.cellId));

  // Keep the turn order: actions is a list of groups played in sequence.
  const actions = (session.actions ?? []).flatMap((group, turn) =>
    group.filter((a) => a.type === 'pick' || a.type === 'ban').map((a) => ({ ...a, turn })),
  );
  const isAlly = (a) => a.isAllyAction ?? allyCells.has(a.actorCellId);
  const picksOf = (cellId) => actions.filter((a) => a.type === 'pick' && a.actorCellId === cellId);
  const pickActionsUsable = kind !== 'aram';

  const ally = (p) => {
    const picks = pickActionsUsable ? picksOf(p.cellId) : [];
    const locked = picks.length ? picks.every((a) => a.completed) && p.championId > 0 : p.championId > 0;
    const current = picks.find((a) => a.isInProgress);
    const hover = locked ? 0 : current?.championId || p.championPickIntent || p.championId || 0;
    return {
      cellId: p.cellId,
      me: p.cellId === myCell,
      role: ROLES[p.assignedPosition] ?? '',
      championId: locked ? p.championId : 0,
      hoverId: hover,
      name: p.anonName ?? '',
    };
  };

  const enemy = (p) => {
    const picks = pickActionsUsable ? picksOf(p.cellId) : [];
    const locked = p.championId > 0 && picks.every((a) => a.completed);
    return { cellId: p.cellId, championId: locked ? p.championId : 0 };
  };

  const bans = (side) => {
    const fromSession = side ? session.bans?.myTeamBans : session.bans?.theirTeamBans;
    if (fromSession?.length) return fromSession.filter((id) => id > 0);
    return actions.filter((a) => a.type === 'ban' && a.completed && isAlly(a) === side && a.championId > 0).map((a) => a.championId);
  };

  const inProgress = actions.filter((a) => a.isInProgress);
  const mine = inProgress.find((a) => a.actorCellId === myCell);
  const myPick = pickActionsUsable ? picksOf(myCell).at(-1) : null;
  const enemyPicksAfterMe = myPick
    ? actions.filter((a) => a.type === 'pick' && !isAlly(a) && !a.completed && a.turn >= myPick.turn).length
    : 0;

  return {
    kind,
    queueId: session.queueId ?? 0,
    phase: session.timer?.phase ?? '',
    timeLeftMs: session.timer?.isInfinite ? null : session.timer?.adjustedTimeLeftInPhase ?? null,
    phaseTotalMs: session.timer?.totalTimeInPhase ?? null,
    myTurn: mine ? mine.type : null,
    acting: inProgress.length
      ? inProgress.some((a) => isAlly(a)) ? (inProgress.some((a) => !isAlly(a)) ? 'both' : 'ally') : 'enemy'
      : null,
    // Ally ban hovers are shown to teammates in the client; enemy ones are not.
    allyBanHovers: inProgress.filter((a) => a.type === 'ban' && isAlly(a) && a.championId > 0).map((a) => a.championId),
    bans: { ally: bans(true), enemy: bans(false) },
    allies: (session.myTeam ?? []).map(ally),
    enemies: (session.theirTeam ?? []).map(enemy),
    enemyPicksAfterMe,
    bench: (session.benchChampions ?? []).map((b) => b.championId).filter((id) => id > 0),
    rerollsRemaining: session.rerollsRemaining ?? 0,
    tradeableCells: (session.trades ?? []).filter((t) => t.state === 'AVAILABLE').map((t) => t.cellId),
  };
}

// Same draft for display purposes, ignoring the timer, so callers can skip redundant updates.
export const draftKey = (s) => JSON.stringify({ ...s, timeLeftMs: undefined });
