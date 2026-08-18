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
    for (const [key, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(key);
    }
  }

  return { ok: true };
}

async function rateLimitRemote(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null;
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_key: params.key,
      p_limit: params.limit,
      p_window_ms: params.windowMs,
    });
    if (error || data == null) return null;
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

/** Best-effort client IP from common proxy headers. */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}
