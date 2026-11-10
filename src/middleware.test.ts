import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.fn(async () => ({ data: { user: { id: 'h' } }, error: null }));
const getSession = vi.fn(async () => ({ data: { session: null } }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser, getSession },
  })),
}));

function request(path: string) {
  return new NextRequest(new URL(path, 'http://qlash.test'));
}

describe('middleware', () => {
  beforeEach(() => {
    getUser.mockClear();
    getSession.mockClear();
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it('skips auth refresh on landing, player, and API routes', async () => {
    const { middleware } = await import('@/middleware');
    const home = await middleware(request('/'));
    const play = await middleware(request('/play/abc'));
    const api = await middleware(request('/api/player/join'));
    const register = await middleware(request('/register'));
    expect(home.status).toBe(200);
    expect(play.status).toBe(200);
    expect(api.status).toBe(200);
    expect(register.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('refreshes the host session on dashboard and host screens', async () => {
    const { middleware } = await import('@/middleware');
    await middleware(request('/dashboard'));
    await middleware(request('/host/sess-1'));
    expect(getUser).toHaveBeenCalled();
  });

  it('reuses a fresh host JWT instead of calling Auth on every tap', async () => {
    const { middleware } = await import('@/middleware');
    const req = new NextRequest(new URL('/dashboard', 'http://qlash.test'), {
      headers: {
        cookie: `sb-qlash-auth-token=${encodeURIComponent(
          JSON.stringify({ expires_at: Math.floor(Date.now() / 1000) + 3600 })
        )}`,
      },
    });
    await middleware(req);
    expect(getSession).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('skips Auth on host-route prefetches', async () => {
    const { middleware } = await import('@/middleware');
    await middleware(
      new NextRequest(new URL('/dashboard', 'http://qlash.test'), {
        headers: { 'next-router-prefetch': '1' },
      })
    );
    expect(getSession).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('stamps a locale cookie from Accept-Language on the first public visit', async () => {
    const { middleware } = await import('@/middleware');
    const req = new NextRequest(new URL('/', 'http://qlash.test'), {
      headers: { 'accept-language': 'ar-EG,ar;q=0.9,en;q=0.8' },
    });
    const res = await middleware(req);
    expect(res.cookies.get('qlash_locale')?.value).toBe('ar');
    expect(res.headers.get('x-qlash-locale')).toBe('ar');
  });

  it('enforces a nonce policy that allows Supabase video and reports violations', async () => {
    const { middleware } = await import('@/middleware');
    const first = await middleware(request('/'));
    const second = await middleware(request('/play/abc'));
    const policy = first.headers.get('Content-Security-Policy') ?? '';
    const again = second.headers.get('Content-Security-Policy') ?? '';
    expect(first.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
    expect(policy).toContain('media-src \'self\' blob: https://*.supabase.co https:');
    expect(policy).toContain('report-uri /api/csp-report');
    expect(policy).toMatch(/'nonce-[^']+'/);
    expect(first.headers.get('Reporting-Endpoints')).toBe('csp-endpoint="/api/csp-report"');
    expect(policy).not.toBe(again);
  });

  it('keeps that policy when an auth refresh rewrites the response', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockImplementationOnce(((
      _url: string,
      _key: string,
      options: {
        cookies: {
          setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
        };
      }
    ) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll([{ name: 'sb-refresh', value: '1' }]);
          return { data: { user: { id: 'h' } }, error: null };
        },
        getSession,
      },
    })) as never);
    const { middleware } = await import('@/middleware');
    const res = await middleware(request('/dashboard'));
    expect(res.headers.get('Content-Security-Policy')).toContain('https://*.supabase.co');
    expect(res.cookies.get('sb-refresh')?.value).toBe('1');
  });

  it('keeps an existing locale cookie', async () => {
    const { middleware } = await import('@/middleware');
    const req = new NextRequest(new URL('/', 'http://qlash.test'), {
      headers: {
        cookie: 'qlash_locale=en',
        'accept-language': 'ar-EG',
      },
    });
    const res = await middleware(req);
    expect(res.cookies.get('qlash_locale')?.value).toBeUndefined();
    expect(res.headers.get('x-qlash-locale')).toBe('en');
  });
});
