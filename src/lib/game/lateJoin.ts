/** Lobby only — no new players after Start. */
export const LATE_JOIN_LOBBY_ONLY = -1;

/** An old QR code or link stops accepting players after this long. */
export const ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function roomOpenedTooLongAgo(createdAt: unknown, now = Date.now()): boolean {
  if (typeof createdAt !== 'string') return false;
  const opened = Date.parse(createdAt);
  if (!Number.isFinite(opened)) return false;
  return now - opened > ROOM_MAX_AGE_MS;
}

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

const PRIOR_JOIN_TOKEN_MAX = 8;
const PRIOR_JOIN_TOKEN_LEN = 80;

/** Tokens this device already holds, capped so a join body cannot carry a list. */
export function priorJoinTokens(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tokens: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const token = item.trim();
    if (!token || token.length > PRIOR_JOIN_TOKEN_LEN) continue;
    tokens.push(token);
    if (tokens.length >= PRIOR_JOIN_TOKEN_MAX) break;
  }
  return tokens;
}

/**
 * A new player may enter the lobby unless the host locked joins.
 * After start, they may enter only while late join is on.
 */
export function canInsertNewPlayer(session: {
  status: string;
  late_join_through_index?: unknown;
  join_locked?: boolean | null;
}): boolean {
  if (session.join_locked) return false;
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
