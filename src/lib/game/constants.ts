/** Hard ceiling for any live room. */
export const MAX_PLAYERS_PER_SESSION = 80;

export const NICKNAME_MIN_LEN = 1;
export const NICKNAME_MAX_LEN = 20;

export type HostPlan = 'free' | 'pro' | 'org';

/** Live seats are 80 on every plan until we turn Free=30 back on. */
export const PLAN_LIMITS: Record<HostPlan, { maxLivePlayers: number; maxQuizzes: number }> = {
  free: { maxLivePlayers: 80, maxQuizzes: 5 },
  pro: { maxLivePlayers: 80, maxQuizzes: Number.POSITIVE_INFINITY },
  org: { maxLivePlayers: 80, maxQuizzes: Number.POSITIVE_INFINITY },
};

export function normalizeHostPlan(plan: unknown): HostPlan {
  if (plan === 'pro' || plan === 'org') return plan;
  return 'free';
}

export function livePlayerCap(plan: unknown): number {
  return Math.min(MAX_PLAYERS_PER_SESSION, PLAN_LIMITS[normalizeHostPlan(plan)].maxLivePlayers);
}

export function quizLibraryCap(plan: unknown): number {
  return PLAN_LIMITS[normalizeHostPlan(plan)].maxQuizzes;
}

/** Classroom Wi‑Fi often NATs many devices behind one IP — keep limits high. */
export const RATE_LIMITS = {
  joinPerIp: { limit: 120, windowMs: 60_000 },
  submitPerIp: { limit: 400, windowMs: 60_000 },
  submitPerPlayer: { limit: 8, windowMs: 60_000 },
} as const;
