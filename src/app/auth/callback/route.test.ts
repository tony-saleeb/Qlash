import { afterEach, describe, expect, it, vi } from 'vitest';

const exchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { exchangeCodeForSession },
  }),
}));

describe('GET /auth/callback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exchanges a code and redirects into the host dashboard', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(new Request('http://qlash.test/auth/callback?code=abc'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://qlash.test/dashboard');
  });

  it('honors next and bounces home when the exchange fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    exchangeCodeForSession.mockResolvedValueOnce({ error: { message: 'bad' } });
    const { GET } = await import('@/app/auth/callback/route');
    const failed = await GET(new Request('http://qlash.test/auth/callback?code=abc&next=/host/1'));
    expect(failed.headers.get('location')).toBe('http://qlash.test/');

    const missing = await GET(new Request('http://qlash.test/auth/callback'));
    expect(missing.headers.get('location')).toBe('http://qlash.test/');
  });

  it('prefers NEXT_PUBLIC_SITE_URL over the request origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://qlash.app');
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(new Request('http://qlash.test/auth/callback?code=abc'));
    expect(response.headers.get('location')).toBe('https://qlash.app/dashboard');
  });

  it('does not exchange a missing code and refuses an off-site next path', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    exchangeCodeForSession.mockClear();
    const { GET } = await import('@/app/auth/callback/route');
    const missing = await GET(new Request('http://qlash.test/auth/callback?next=/dashboard'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(missing.headers.get('location')).toBe('http://qlash.test/');

    exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const offsite = await GET(
      new Request('http://qlash.test/auth/callback?code=abc&next=https://evil.com')
    );
    expect(offsite.headers.get('location')).toBe('http://qlash.test/dashboard');

    exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const kept = await GET(
      new Request('http://qlash.test/auth/callback?code=abc&next=/dashboard/quizzes/1')
    );
    expect(kept.headers.get('location')).toBe('http://qlash.test/dashboard/quizzes/1');
  });
});
