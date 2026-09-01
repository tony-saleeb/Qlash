import { describe, expect, it } from 'vitest';
import { cookieSessionExpiresAt, isHostAuthPrefetch, sessionNeedsRefresh } from '@/lib/supabase/hostSession';

describe('sessionNeedsRefresh', () => {
  it('refreshes when the expiry is missing or already past', () => {
    expect(sessionNeedsRefresh(undefined, 1_000_000)).toBe(true);
    expect(sessionNeedsRefresh(500, 1_000_000)).toBe(true);
  });

  it('keeps a token that still has more than two minutes left', () => {
    const now = 1_700_000_000_000;
    expect(sessionNeedsRefresh(now / 1000 + 600, now)).toBe(false);
    expect(sessionNeedsRefresh(now / 1000 + 60, now)).toBe(true);
  });
});

describe('cookieSessionExpiresAt', () => {
  it('reads expires_at from the sb auth cookie', () => {
    expect(
      cookieSessionExpiresAt([
        { name: 'qlash_locale', value: 'ar' },
        { name: 'sb-abc-auth-token', value: JSON.stringify({ expires_at: 1_800_000_000 }) },
      ])
    ).toBe(1_800_000_000);
  });

  it('joins chunked cookies', () => {
    expect(
      cookieSessionExpiresAt([
        { name: 'sb-abc-auth-token.1', value: '000}' },
        { name: 'sb-abc-auth-token.0', value: '{"expires_at":1800' },
      ])
    ).toBe(1_800_000);
  });
});

describe('isHostAuthPrefetch', () => {
  it('detects App Router prefetch headers', () => {
    expect(isHostAuthPrefetch({ get: (name) => (name === 'next-router-prefetch' ? '1' : null) })).toBe(true);
    expect(isHostAuthPrefetch({ get: () => null })).toBe(false);
  });
});
