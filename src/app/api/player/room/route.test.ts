import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(() => ({ ok: true as const })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  clientIpFromRequest: () => 'test-ip',
}));

const admin = createClientMock();

describe('POST /api/player/room', () => {
  beforeEach(() => {
    admin.reset();
    rateLimitMock.mockReturnValue({ ok: true });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('returns teamMode without a session id', async () => {
    admin.setTable('game_sessions', {
      data: { quizzes: { team_mode: true } },
      error: null,
    });
    const { POST } = await import('@/app/api/player/room/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456' })));
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ teamMode: true });
    expect(result.body.sessionId).toBeUndefined();
  });

  it('returns teamMode false for an unknown PIN', async () => {
    admin.setTable('game_sessions', { data: null, error: null });
    const { POST } = await import('@/app/api/player/room/route');
    const result = await readJson(await POST(jsonRequest({ pin: '000000' })));
    expect(result.body).toEqual({ teamMode: false });
  });
});
