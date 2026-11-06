import { afterEach, describe, expect, it, vi } from 'vitest';

const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { verifyOtp },
  }),
}));

describe('GET /auth/confirm', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    verifyOtp.mockReset();
  });

  it('verifies the token and redirects into the host dashboard', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    verifyOtp.mockResolvedValueOnce({ error: null });
    const { GET } = await import('@/app/auth/confirm/route');
    const response = await GET(
      new Request('http://qlash.test/auth/confirm?token_hash=abc&type=email')
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'abc' });
    expect(response.headers.get('location')).toBe('http://qlash.test/dashboard');
  });

  it('sends missing params to the auth error page', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { GET } = await import('@/app/auth/confirm/route');
    const response = await GET(new Request('http://qlash.test/auth/confirm'));
    expect(response.headers.get('location')).toBe('http://qlash.test/?authError=1');
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('ignores a protocol-relative next path', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    verifyOtp.mockResolvedValueOnce({ error: null });
    const { GET } = await import('@/app/auth/confirm/route');
    const response = await GET(
      new Request('http://qlash.test/auth/confirm?token_hash=abc&type=email&next=//evil.com')
    );
    expect(response.headers.get('location')).toBe('http://qlash.test/dashboard');
  });
});
