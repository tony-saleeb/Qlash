/** Milliseconds left on a question clock, anchored to a server timestamp. */
export function remainingMs(
  startedAtIso: string | null | undefined,
  timeLimitSeconds: number,
  now = Date.now()
): number {
  if (!timeLimitSeconds || timeLimitSeconds < 0) return 0;
  if (!startedAtIso) return timeLimitSeconds * 1000;
  const started = new Date(startedAtIso).getTime();
  if (!Number.isFinite(started)) return timeLimitSeconds * 1000;
  return Math.max(0, timeLimitSeconds * 1000 - (now - started));
}

/** Whole seconds left. Floor so "1" means at least a full second remains. */
export function remainingSeconds(
  startedAtIso: string | null | undefined,
  timeLimitSeconds: number,
  now = Date.now()
): number {
  return Math.floor(remainingMs(startedAtIso, timeLimitSeconds, now) / 1000);
}

/** Rebuild a wall-clock start so clients keep ticking in lockstep after pause/add-time. */
export function startedAtFromRemaining(
  timeLimitSeconds: number,
  remaining: number,
  now = Date.now()
): string {
  const elapsedMs = Math.max(0, timeLimitSeconds - remaining) * 1000;
  return new Date(now - elapsedMs).toISOString();
}

/** Pause encoding stores elapsed ms in question_started_at (epoch offset). */
export function remainingFromPausedElapsed(
  pausedStartedAtIso: string | null | undefined,
  timeLimitSeconds: number
): number {
  if (!pausedStartedAtIso || !timeLimitSeconds) return timeLimitSeconds;
  const elapsedMs = new Date(pausedStartedAtIso).getTime();
  if (!Number.isFinite(elapsedMs)) return timeLimitSeconds;
  return Math.max(0, Math.floor(timeLimitSeconds - elapsedMs / 1000));
}
