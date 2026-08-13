import { describe, expect, it, vi } from 'vitest';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  it('allows the first hit and subsequent hits under the cap', () => {
    const key = `unit-allow-${Math.random()}`;
    expect(rateLimit({ key, limit: 3, windowMs: 60_000 })).toEqual({ ok: true });
    expect(rateLimit({ key, limit: 3, windowMs: 60_000 })).toEqual({ ok: true });
    expect(rateLimit({ key, limit: 3, windowMs: 60_000 })).toEqual({ ok: true });
  });

  it('blocks when the bucket is full and reports retry-after', () => {
    const key = `unit-block-${Math.random()}`;
    rateLimit({ key, limit: 1, windowMs: 30_000 });
    const blocked = rateLimit({ key, limit: 1, windowMs: 30_000 });
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
    expect(rateLimit({ key, limit: 1, windowMs: 1000 }).ok).toBe(true);
    expect(rateLimit({ key, limit: 1, windowMs: 1000 }).ok).toBe(false);
    nowSpy.mockReturnValue(now + 1000);
    expect(rateLimit({ key, limit: 1, windowMs: 1000 }).ok).toBe(true);
  });
});

describe('clientIpFromRequest', () => {
  it('uses the first x-forwarded-for hop', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '10.0.0.8, 10.0.0.1' },
    });
    expect(clientIpFromRequest(request)).toBe('10.0.0.8');
  });

  it('falls back to x-real-ip then unknown', () => {
    expect(
      clientIpFromRequest(new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } }))
    ).toBe('9.9.9.9');
    expect(clientIpFromRequest(new Request('http://localhost'))).toBe('unknown');
  });
});
