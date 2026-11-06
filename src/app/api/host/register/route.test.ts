import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest, readJson } from '@/test/supabaseMock';
import type { HostRegisterAdmin, HostRegisterInput } from '@/lib/host/registerHost';

type RateLimitResult = { ok: boolean; retryAfterSec?: number };
type RateLimitParams = { key: string; limit: number; windowMs: number };

const { rateLimitMock, createConfirmedHostMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn((params: RateLimitParams): RateLimitResult => {
    void params;
    return { ok: true };
  }),
  createConfirmedHostMock: vi.fn(async (admin: HostRegisterAdmin, input: HostRegisterInput) => {
    void admin;
    void input;
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (params: RateLimitParams) => rateLimitMock(params),
  clientIpFromRequest: (request: Request) => request.headers.get('x-forwarded-for') || 'test-ip',
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: {} } })),
}));

vi.mock('@/lib/host/registerHost', async () => {
  const actual = await vi.importActual<typeof import('@/lib/host/registerHost')>('@/lib/host/registerHost');
  return {
    ...actual,
    createConfirmedHost: (admin: HostRegisterAdmin, input: HostRegisterInput) =>
      createConfirmedHostMock(admin, input),
  };
});

describe('POST /api/host/register', () => {
  beforeEach(() => {
    rateLimitMock.mockReturnValue({ ok: true });
    createConfirmedHostMock.mockReset();
    createConfirmedHostMock.mockResolvedValue(undefined);
  });

  it('creates a confirmed host', async () => {
    const { POST } = await import('@/app/api/host/register/route');
    const result = await readJson(
      await POST(
        jsonRequest({ email: 'host@qlash.test', password: 'secret1', displayName: 'Mira' })
      )
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(createConfirmedHostMock).toHaveBeenCalledWith(expect.anything(), {
      email: 'host@qlash.test',
      password: 'secret1',
      displayName: 'Mira',
    });
  });

  it('rate-limits sign-ups by IP', async () => {
    rateLimitMock.mockReturnValueOnce({ ok: false, retryAfterSec: 30 });
    const { POST } = await import('@/app/api/host/register/route');
    const result = await readJson(
      await POST(
        jsonRequest({ email: 'host@qlash.test', password: 'secret1', displayName: 'Mira' })
      )
    );
    expect(result.status).toBe(429);
    expect(createConfirmedHostMock).not.toHaveBeenCalled();
  });
});
