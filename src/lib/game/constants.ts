/** Hard capacity target for a single live room. */
export const MAX_PLAYERS_PER_SESSION = 80;

export const NICKNAME_MIN_LEN = 1;
export const NICKNAME_MAX_LEN = 20;

/** Classroom Wi‑Fi often NATs many devices behind one IP — keep limits high. */
export const RATE_LIMITS = {
  joinPerIp: { limit: 120, windowMs: 60_000 },
  submitPerIp: { limit: 400, windowMs: 60_000 },
  submitPerPlayer: { limit: 8, windowMs: 60_000 },
} as const;
