import { createHash } from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** A player or session id that is not a uuid shares one bucket, so junk ids cannot grow the table. */
export function scopedRateLimitKey(scope: string, id: unknown): string {
  return isUuid(id) ? `${scope}:${id}` : `${scope}:invalid`;
}

/** Short stable suffix so a guessed player id cannot share the real token's bucket. */
export function tokenBucketSuffix(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}
