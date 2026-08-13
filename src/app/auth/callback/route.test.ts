import { describe, expect, it, vi } from 'vitest';

const exchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { exchangeCodeForSession },
  }),
}));

describe('GET /auth/callback', () => {
  it('exchanges a code and redirects into the host dashboard', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(new Request('http://qlash.test/auth/callback?code=abc'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://qlash.test/dashboard');
  });

  it('honors next and bounces home when the exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: { message: 'bad' } });
    const { GET } = await import('@/app/auth/callback/route');
    const failed = await GET(new Request('http://qlash.test/auth/callback?code=abc&next=/host/1'));
    expect(failed.headers.get('location')).toBe('http://qlash.test/');

    const missing = await GET(new Request('http://qlash.test/auth/callback'));
    expect(missing.headers.get('location')).toBe('http://qlash.test/');
  });
});
