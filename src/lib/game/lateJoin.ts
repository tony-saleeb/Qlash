/** Lobby only — no new players after Start. */
export const LATE_JOIN_LOBBY_ONLY = -1;

/**
 * Stored when late join is on. Any non-negative value means join until the game
 * ends; players pick up the current question and score from there.
 */
export const DEFAULT_LATE_JOIN_THROUGH_INDEX = 2;

export function normalizeLateJoinThroughIndex(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_LATE_JOIN_THROUGH_INDEX;
  }
  const n = Math.trunc(value);
  return n < LATE_JOIN_LOBBY_ONLY ? LATE_JOIN_LOBBY_ONLY : n;
}

export function isLateJoinEnabled(throughIndex: unknown): boolean {
  return normalizeLateJoinThroughIndex(throughIndex) >= 0;
}

/** Whether a brand-new player (not a reconnect) may insert into this session. */
export function canInsertNewPlayer(session: {
  status: string;
  current_question_index?: number | null;
  late_join_through_index?: number | null;
}): boolean {
  if (session.status === 'finished') return false;
  if (session.status === 'lobby') return true;
  return isLateJoinEnabled(session.late_join_through_index);
}

/** True when this player arrived after the current question had already started. */
export function playerJoinedAfterQuestionStart(
  joinedAt: string | null | undefined,
  questionStartedAt: string | null | undefined
): boolean {
  const joined = joinedAt ? Date.parse(joinedAt) : NaN;
  const started = questionStartedAt ? Date.parse(questionStartedAt) : NaN;
  if (!Number.isFinite(joined) || !Number.isFinite(started)) return false;
  return joined > started;
}

export function hostClickerPath(sessionId: string): string {
  return `/host/${sessionId}?view=clicker`;
}

export function isHostClickerView(view: string | string[] | undefined): boolean {
  const value = Array.isArray(view) ? view[0] : view;
  return value === 'clicker' || value === 'remote';
}
