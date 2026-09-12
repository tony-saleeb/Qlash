/**
 * A player who misses the question payload sees nothing but a spinner, so
 * hydration has to heal itself. One 429 from a classroom sharing a single
 * school IP must never cost a student the whole question.
 */

export const HYDRATE_MAX_ATTEMPTS = 4;

/** Slow enough to stay under the per-player bucket, fast enough to feel live. */
export const HYDRATE_WATCHDOG_MS = 2_500;

const HYDRATE_BACKOFF_MS = [400, 900, 1800, 3000];
const HYDRATE_MAX_DELAY_MS = 5_000;

/** Retry transient failures only — a bad token or a missing row will not heal. */
export function hydrateShouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function hydrateRetryDelayMs(attempt: number, retryAfterSec?: number | null): number {
  const base = HYDRATE_BACKOFF_MS[Math.min(Math.max(attempt, 0), HYDRATE_BACKOFF_MS.length - 1)];
  if (typeof retryAfterSec === 'number' && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.min(Math.max(retryAfterSec * 1000, base), HYDRATE_MAX_DELAY_MS);
  }
  return base;
}

/** True when the player should be looking at a question but has no payload. */
export function needsQuestionHydrate(params: { status: string; hasQuestion: boolean }): boolean {
  if (params.hasQuestion) return false;
  return (
    params.status === 'question_active' ||
    params.status === 'question_paused' ||
    params.status === 'question_reveal' ||
    params.status === 'leaderboard'
  );
}
