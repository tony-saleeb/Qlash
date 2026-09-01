import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_PIN } from '@/lib/game/demoRoom';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const { rateLimitMock, ensureDemoSessionMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(() => ({ ok: true as const })),
  ensureDemoSessionMock: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  clientIpFromRequest: (request: Request) => request.headers.get('x-forwarded-for') || 'test-ip',
}));

vi.mock('@/lib/game/demoRoom', () => ({
  DEMO_PIN: '100000',
  ensureDemoSession: (...args: unknown[]) => ensureDemoSessionMock(...args),
}));

const admin = createClientMock();

describe('GET /api/demo/ensure', () => {
  beforeEach(() => {
    admin.reset();
    rateLimitMock.mockReturnValue({ ok: true });
    ensureDemoSessionMock.mockReset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('returns the live demo session', async () => {
    ensureDemoSessionMock.mockResolvedValue({ sessionId: 'sess-demo', pin: DEMO_PIN });
    const { GET } = await import('@/app/api/demo/ensure/route');
    const response = await GET(new Request('http://localhost/api/demo/ensure'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      pin: DEMO_PIN,
      sessionId: 'sess-demo',
      ready: true,
      playerCount: 0,
    });
  });

  it('returns 503 when no host exists yet', async () => {
    ensureDemoSessionMock.mockResolvedValue(null);
    const { GET } = await import('@/app/api/demo/ensure/route');
    const response = await GET(new Request('http://localhost/api/demo/ensure'));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ pin: DEMO_PIN, ready: false });
  });
});
