import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

type RateLimitResult = { ok: boolean; retryAfterSec?: number };
type RateLimitParams = { key: string; limit: number; windowMs: number };

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn((params: RateLimitParams): RateLimitResult => {
    void params;
    return { ok: true };
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (params: RateLimitParams) => rateLimitMock(params),
  clientIpFromRequest: () => 'test-ip',
}));

const admin = createClientMock();

describe('POST /api/player/roster', () => {
  beforeEach(() => {
    admin.reset();
    rateLimitMock.mockReturnValue({ ok: true });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('rejects a missing token', async () => {
    const { POST } = await import('@/app/api/player/roster/route');
    const result = await readJson(await POST(jsonRequest({ sessionId: 'sess-1' })));
    expect(result.status).toBe(400);
  });

  it('returns scores for the caller session only', async () => {
    admin.setTables({
      player_tokens: { data: { player_id: 'p1', client_token: 'tok' }, error: null },
      players: [
        { data: { id: 'p1' }, error: null },
        {
          data: [
            { id: 'p1', nickname: 'Ada', team_name: 'Red', score: 900, streak: 1, connected: true },
            { id: 'p2', nickname: 'Bob', team_name: 'Blue', score: 100, streak: 0, connected: true },
          ],
          error: null,
        },
      ],
    });
    const { POST } = await import('@/app/api/player/roster/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.players[0]).toEqual({
      nickname: 'Ada',
      score: 900,
      streak: 1,
      connected: true,
      team_name: 'Red',
      isMe: true,
    });
    expect(result.body.players[1].isMe).toBe(false);
    expect(JSON.stringify(result.body)).not.toContain('p2');
  });
});
