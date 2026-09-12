import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  RATE_LIMIT_SHARDS,
  clientIpFromRequest,
  rateLimit,
  rateLimitMemory,
  rateLimitSharded,
  resetRemoteRateLimitProbe,
  shardedRateLimitBudget,
  shardedRateLimitKey,
} from '@/lib/rate-limit';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

describe('rateLimitMemory', () => {
  it('allows the first hit and subsequent hits under the cap', () => {
    const key = `unit-allow-${Math.random()}`;
    expect(rateLimitMemory({ key, limit: 3, windowMs: 60_000 })).toEqual({ ok: true });
    expect(rateLimitMemory({ key, limit: 3, windowMs: 60_000 })).toEqual({ ok: true });
    expect(rateLimitMemory({ key, limit: 3, windowMs: 60_000 })).toEqual({ ok: true });
  });

  it('blocks when the bucket is full and reports retry-after', () => {
    const key = `unit-block-${Math.random()}`;
    rateLimitMemory({ key, limit: 1, windowMs: 30_000 });
    const blocked = rateLimitMemory({ key, limit: 1, windowMs: 30_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
      expect(blocked.retryAfterSec).toBeLessThanOrEqual(30);
    }
  });

  it('resets after the window elapses', () => {
    const key = `unit-reset-${Math.random()}`;
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(now);
    expect(rateLimitMemory({ key, limit: 1, windowMs: 1000 }).ok).toBe(true);
    expect(rateLimitMemory({ key, limit: 1, windowMs: 1000 }).ok).toBe(false);
    nowSpy.mockReturnValue(now + 1000);
    expect(rateLimitMemory({ key, limit: 1, windowMs: 1000 }).ok).toBe(true);
  });
});

describe('rateLimit remote', () => {
  beforeEach(() => {
    admin.reset();
    resetRemoteRateLimitProbe();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  });

  it('stops calling a missing RPC on every request', async () => {
    admin.setRpc('consume_rate_limit', { data: null, error: { message: 'function does not exist' } });
    await rateLimit({ key: `probe-${Math.random()}`, limit: 50, windowMs: 30_000 });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    await rateLimit({ key: `probe-${Math.random()}`, limit: 50, windowMs: 30_000 });
    await rateLimit({ key: `probe-${Math.random()}`, limit: 50, windowMs: 30_000 });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
  });

  it('uses consume_rate_limit when the RPC answers', async () => {
    admin.setRpc('consume_rate_limit', { data: { ok: true }, error: null });
    await expect(rateLimit({ key: 'join:10.0.0.1', limit: 10, windowMs: 1000 })).resolves.toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_key: 'join:10.0.0.1',
      p_limit: 10,
      p_window_ms: 1000,
    });
  });

  it('falls back to memory when the RPC is missing', async () => {
    admin.setRpc('consume_rate_limit', { data: null, error: { message: 'function does not exist' } });
    const key = `fallback-${Math.random()}`;
    await expect(rateLimit({ key, limit: 1, windowMs: 30_000 })).resolves.toEqual({ ok: true });
    const blocked = await rateLimit({ key, limit: 1, windowMs: 30_000 });
    expect(blocked.ok).toBe(false);
  });
});

describe('sharded buckets', () => {
  beforeEach(() => {
    resetRemoteRateLimitProbe();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('keeps a player on one shard and spreads a class over many', () => {
    expect(shardedRateLimitKey('submit:1.2.3.4', 'p1')).toBe(
      shardedRateLimitKey('submit:1.2.3.4', 'p1')
    );
    const shards = new Set(
      Array.from({ length: 80 }, (_, i) => shardedRateLimitKey('submit:1.2.3.4', `player-${i}`))
    );
    expect(shards.size).toBeGreaterThan(1);
    expect(shards.size).toBeLessThanOrEqual(RATE_LIMIT_SHARDS);
  });

  it('divides the budget so the total stays put', () => {
    expect(shardedRateLimitBudget(900)).toBe(113);
    expect(shardedRateLimitBudget(900) * RATE_LIMIT_SHARDS).toBeGreaterThanOrEqual(900);
    expect(shardedRateLimitBudget(2)).toBe(1);
  });

  it('still throttles a single player hammering one shard', async () => {
    const key = `sharded-${Math.random()}`;
    const params = { key, seed: 'p1', limit: 8, windowMs: 30_000, shards: 8 };
    await expect(rateLimitSharded(params)).resolves.toEqual({ ok: true });
    const blocked = await rateLimitSharded(params);
    expect(blocked.ok).toBe(false);
  });
});

describe('clientIpFromRequest', () => {
  it('prefers the Vercel hop, then the last x-forwarded-for hop', () => {
    expect(
      clientIpFromRequest(
        new Request('http://localhost', {
          headers: {
            'x-forwarded-for': '10.0.0.8, 10.0.0.1',
            'x-vercel-forwarded-for': '10.0.0.1',
          },
        })
      )
    ).toBe('10.0.0.1');
    expect(
      clientIpFromRequest(
        new Request('http://localhost', { headers: { 'x-forwarded-for': '10.0.0.8, 10.0.0.1' } })
      )
    ).toBe('10.0.0.1');
  });

  it('falls back to x-real-ip then unknown', () => {
    expect(
      clientIpFromRequest(new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } }))
    ).toBe('9.9.9.9');
    expect(clientIpFromRequest(new Request('http://localhost'))).toBe('unknown');
  });
});
