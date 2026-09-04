import { randomInt } from 'node:crypto';

/** Six-digit live PIN. Unique index on game_sessions.pin retries collisions. */
export function randomLivePin(): string {
  return String(randomInt(100000, 1_000_000));
}
