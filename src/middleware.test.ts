import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.fn(async () => ({ data: { user: { id: 'h' } }, error: null }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}));

function request(path: string) {
  return new NextRequest(new URL(path, 'http://qlash.test'));
}

describe('middleware', () => {
  it('skips auth refresh on landing, player, and API routes', async () => {
    const { middleware } = await import('@/middleware');
    const home = await middleware(request('/'));
    const play = await middleware(request('/play/abc'));
    const api = await middleware(request('/api/player/join'));
    expect(home.status).toBe(200);
    expect(play.status).toBe(200);
    expect(api.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('refreshes the host session on dashboard and host screens', async () => {
    const { middleware } = await import('@/middleware');
    await middleware(request('/dashboard'));
    await middleware(request('/host/sess-1'));
    expect(getUser).toHaveBeenCalled();
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
