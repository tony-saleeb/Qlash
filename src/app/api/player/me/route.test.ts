import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

describe('POST /api/player/me', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('requires sessionId and token', async () => {
    const { POST } = await import('@/app/api/player/me/route');
    expect((await readJson(await POST(jsonRequest({ sessionId: 's' })))).status).toBe(400);
  });

  it('rejects an unknown token', async () => {
    admin.setTable('player_tokens', { data: null, error: null });
    const { POST } = await import('@/app/api/player/me/route');
    const result = await readJson(await POST(jsonRequest({ sessionId: 'sess-1', token: 'bad' })));
    expect(result.status).toBe(401);
  });

  it('rejects a token that belongs to a different session', async () => {
    admin.setTables({
      player_tokens: { data: { player_id: 'p1', client_token: 'tok' }, error: null },
      players: { data: null, error: null },
      game_sessions: { data: { status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/me/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', token: 'tok' }))
    );
    expect(result.status).toBe(404);
  });

  it('rejects a nickname that does not match the stored player', async () => {
    admin.setTables({
      player_tokens: { data: { player_id: 'p1', client_token: 'tok' }, error: null },
      players: {
        data: { id: 'p1', session_id: 'sess-1', nickname: 'Ada', score: 0, streak: 0, connected: false, joined_at: '', team_name: null },
        error: null,
      },
      game_sessions: { data: { status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/me/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', token: 'tok', nickname: 'Bob' }))
    );
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/Nickname does not match/);
  });

  it('rejects a finished session', async () => {
    admin.setTables({
      player_tokens: { data: { player_id: 'p1', client_token: 'tok' }, error: null },
      players: {
        data: { id: 'p1', session_id: 'sess-1', nickname: 'Ada', score: 10, streak: 1, connected: false, joined_at: '', team_name: null },
        error: null,
      },
      game_sessions: { data: { status: 'finished' }, error: null },
    });
    const { POST } = await import('@/app/api/player/me/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', token: 'tok' }))
    );
    expect(result.status).toBe(403);
  });

  it('returns the player as connected on a valid token', async () => {
    const player = {
      id: 'p1',
      session_id: 'sess-1',
      nickname: 'Ada',
      score: 40,
      streak: 2,
      connected: false,
      joined_at: '2026-08-13T20:00:00.000Z',
      team_name: null,
    };
    admin.setTables({
      player_tokens: { data: { player_id: 'p1', client_token: 'tok' }, error: null },
      players: { data: player, error: null },
      game_sessions: { data: { status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/me/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', token: 'tok', nickname: 'Ada' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.player).toMatchObject({ id: 'p1', nickname: 'Ada', connected: true });
    expect(result.body.sessionStatus).toBe('lobby');
  });
});
