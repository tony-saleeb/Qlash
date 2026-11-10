/**
 * Rate limiter: Postgres buckets when the RPC exists (multi-instance Vercel),
 * in-memory fallback when that function is not installed yet.
 */

import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/** Keys longer than this never reach Postgres or the memory map as raw text. */
const MAX_RATE_LIMIT_KEY_CHARS = 512;

type Bucket = { count: number; resetAt: number };
type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const buckets = new Map<string, Bucket>();

export function boundRateLimitKey(key: string): string {
  if (key.length <= MAX_RATE_LIMIT_KEY_CHARS && !key.includes('\0')) return key;
  return createHash('sha256').update(key).digest('hex');
}

export function rateLimitMemory(params: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const key = boundRateLimitKey(params.key);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + params.windowMs });
    return { ok: true };
  }

  if (existing.count >= params.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;

  if (buckets.size > 4000) {
    buckets.forEach((bucket, bucketKey) => {
      if (now >= bucket.resetAt) buckets.delete(bucketKey);
    });
  }

  return { ok: true };
}

/**
 * When the RPC is missing, stop paying a doomed round-trip on every request.
 * Re-probe once a minute so applying the migration heals without a redeploy.
 */
const REMOTE_PROBE_COOLDOWN_MS = 60_000;
let remoteUnavailableUntil = 0;

/** Test seam — clears the "RPC is missing" memo. */
export function resetRemoteRateLimitProbe() {
  remoteUnavailableUntil = 0;
}

function missingRateLimitRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42883' || error.code === 'PGRST202') return true;
  const message = error.message ?? '';
  return /does not exist/i.test(message) || /could not find the function/i.test(message);
}

async function rateLimitRemote(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null;
  }
  if (Date.now() < remoteUnavailableUntil) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_key: boundRateLimitKey(params.key),
      p_limit: params.limit,
      p_window_ms: params.windowMs,
    });
    if (error || data == null) {
      if (missingRateLimitRpc(error)) {
        remoteUnavailableUntil = Date.now() + REMOTE_PROBE_COOLDOWN_MS;
      }
      return null;
    }
    remoteUnavailableUntil = 0;
    const result = data as { ok?: boolean; retryAfterSec?: number };
    if (result.ok) return { ok: true };
    return {
      ok: false,
      retryAfterSec: Math.max(1, Number(result.retryAfterSec) || 1),
    };
  } catch {
    return null;
  }
}

export async function rateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const remote = await rateLimitRemote(params);
  if (remote) return remote;
  return rateLimitMemory(params);
}

/**
 * A class shares one school IP, so an un-sharded per-IP bucket is a single
 * Postgres row that all 80 phones must lock in turn. Spreading the bucket over
 * fixed shards keeps the same total budget without the queue.
 */
export const RATE_LIMIT_SHARDS = 8;

export function shardedRateLimitKey(key: string, seed: string, shards = RATE_LIMIT_SHARDS): string {
  const source = seed.length > 128 ? seed.slice(0, 128) : seed;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  return `${key}#${Math.abs(hash) % shards}`;
}

export function shardedRateLimitBudget(limit: number, shards = RATE_LIMIT_SHARDS): number {
  return Math.max(1, Math.ceil(limit / shards));
}

/** Per-IP limiting for a hot path. `seed` must be stable per player. */
export async function rateLimitSharded(params: {
  key: string;
  seed: string;
  limit: number;
  windowMs: number;
  shards?: number;
}): Promise<RateLimitResult> {
  const shards = params.shards ?? RATE_LIMIT_SHARDS;
  return rateLimit({
    key: shardedRateLimitKey(params.key, params.seed, shards),
    limit: shardedRateLimitBudget(params.limit, shards),
    windowMs: params.windowMs,
  });
}

/** Best-effort client IP. Prefer the platform hop so clients cannot spoof XFF. */
export function clientIpFromRequest(request: Request): string {
  const vercel = request.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0]?.trim() || 'unknown';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    return hops[hops.length - 1] || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
