import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

describe('POST /api/player/round-result', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('requires all identity fields', async () => {
    const { POST } = await import('@/app/api/player/round-result/route');
    expect((await readJson(await POST(jsonRequest({ sessionId: 's', playerId: 'p' })))).status).toBe(400);
  });

  it('rejects a bad token', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'other' }, error: null },
      game_sessions: { data: { status: 'question_reveal' }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(401);
  });

  it('hides results until reveal/leaderboard/finished', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      game_sessions: { data: { status: 'question_active' }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(403);
  });

  it('returns the caller submission and live score, defaulting a miss when none exists', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      game_sessions: { data: { status: 'question_reveal' }, error: null },
      answers_submitted: { data: null, error: null },
      players: { data: { score: 1200, streak: 0 }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.submission).toEqual({ points_awarded: 0, is_correct: false });
    expect(result.body.player).toEqual({ score: 1200, streak: 0 });
  });
});
