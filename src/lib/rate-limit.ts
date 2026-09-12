/**
 * Rate limiter: Postgres buckets when the RPC exists (multi-instance Vercel),
 * in-memory fallback so a missing migration never takes down a live room.
 */

import { createAdminClient } from '@/lib/supabase/admin';

type Bucket = { count: number; resetAt: number };
type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const buckets = new Map<string, Bucket>();

export function rateLimitMemory(params: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(params.key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs });
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
    buckets.forEach((bucket, key) => {
      if (now >= bucket.resetAt) buckets.delete(key);
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
      p_key: params.key,
      p_limit: params.limit,
      p_window_ms: params.windowMs,
    });
    if (error || data == null) {
      remoteUnavailableUntil = Date.now() + REMOTE_PROBE_COOLDOWN_MS;
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
    remoteUnavailableUntil = Date.now() + REMOTE_PROBE_COOLDOWN_MS;
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
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
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
