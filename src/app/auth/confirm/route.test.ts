import { afterEach, describe, expect, it, vi } from 'vitest';

const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { verifyOtp },
  }),
}));

function postConfirm(url: string, fields: Record<string, string>, headers?: Record<string, string>) {
  return new Request(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

describe('GET /auth/confirm', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    verifyOtp.mockReset();
  });

  it('shows a continue button and does not sign in on the email click', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { GET } = await import('@/app/auth/confirm/route');
    const response = await GET(
      new Request('http://qlash.test/auth/confirm?token_hash=abc"><script>&type=email')
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(html).toContain('method="post"');
    expect(html).toContain('value="abc&quot;&gt;&lt;script&gt;"');
    expect(html).not.toContain('<script>');
  });

  it('sends missing params to the auth error page', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { GET } = await import('@/app/auth/confirm/route');
    const response = await GET(new Request('http://qlash.test/auth/confirm'));
    expect(response.headers.get('location')).toBe('http://qlash.test/?authError=1');
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects an unexpected otp type without verifying', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { GET } = await import('@/app/auth/confirm/route');
    const badType = await GET(
      new Request('http://qlash.test/auth/confirm?token_hash=abc&type=phone_change')
    );
    expect(badType.headers.get('location')).toBe('http://qlash.test/?authError=1');
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe('POST /auth/confirm', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    verifyOtp.mockReset();
  });

  it('verifies the token and redirects into the host dashboard', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    verifyOtp.mockResolvedValueOnce({ error: null });
    const { POST } = await import('@/app/auth/confirm/route');
    const response = await POST(
      postConfirm('http://qlash.test/auth/confirm', { token_hash: 'abc', type: 'email' })
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'abc' });
    expect(response.headers.get('location')).toBe('http://qlash.test/dashboard');
  });

  it('ignores a protocol-relative next path', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    verifyOtp.mockResolvedValueOnce({ error: null });
    const { POST } = await import('@/app/auth/confirm/route');
    const response = await POST(
      postConfirm('http://qlash.test/auth/confirm', {
        token_hash: 'abc',
        type: 'email',
        next: '//evil.com',
      })
    );
    expect(response.headers.get('location')).toBe('http://qlash.test/dashboard');
  });

  it('refuses a cross-site post before it signs anyone in', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { POST } = await import('@/app/auth/confirm/route');
    const response = await POST(
      postConfirm(
        'http://qlash.test/auth/confirm',
        { token_hash: 'abc', type: 'email' },
        { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }
      )
    );
    expect(response.status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects a failed verification', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    verifyOtp.mockResolvedValueOnce({ error: { message: 'expired' } });
    const { POST } = await import('@/app/auth/confirm/route');
    const failed = await POST(
      postConfirm('http://qlash.test/auth/confirm', {
        token_hash: 'abc',
        type: 'signup',
        next: '/dashboard/quizzes',
      })
    );
    expect(failed.headers.get('location')).toBe('http://qlash.test/?authError=1');
  });

  it('keeps an in-app next path and drops a backslash path', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://qlash.app');
    verifyOtp.mockResolvedValueOnce({ error: null });
    const { POST } = await import('@/app/auth/confirm/route');
    const kept = await POST(
      postConfirm('https://evil.example/auth/confirm', {
        token_hash: 'abc',
        type: 'recovery',
        next: '/host/sess-1',
      }, { origin: 'https://qlash.app' })
    );
    expect(kept.headers.get('location')).toBe('https://qlash.app/host/sess-1');

    verifyOtp.mockResolvedValueOnce({ error: null });
    const dropped = await POST(
      postConfirm('https://evil.example/auth/confirm', {
        token_hash: 'abc',
        type: 'email',
        next: '/\\evil.com',
      }, { origin: 'https://qlash.app' })
    );
    expect(dropped.headers.get('location')).toBe('https://qlash.app/dashboard');
  });
});
