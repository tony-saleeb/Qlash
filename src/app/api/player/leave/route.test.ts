import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

describe('POST /api/player/leave', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('requires identity fields', async () => {
    const { POST } = await import('@/app/api/player/leave/route');
    expect((await readJson(await POST(jsonRequest({ sessionId: 's', playerId: 'p' })))).status).toBe(400);
  });

  it('rejects a bad token', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'other', player_id: 'p1' }, error: null },
      players: { data: { id: 'p1', session_id: 'sess-1' }, error: null },
      game_sessions: { data: { id: 'sess-1', status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/leave/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(401);
  });

  it('removes the last lobby player and closes the room', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok', player_id: 'p1' }, error: null },
      players: [
        { data: { id: 'p1', session_id: 'sess-1' }, error: null },
        { data: {}, error: null },
        { data: null, error: null, count: 0 },
      ],
      game_sessions: [
        { data: { id: 'sess-1', status: 'lobby' }, error: null },
        { data: {}, error: null },
      ],
    });
    const { POST } = await import('@/app/api/player/leave/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, roomClosed: true });
    expect(admin.lastUpdate('game_sessions')).toEqual({ status: 'finished' });
  });

  it('leaves other lobby players in place', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok', player_id: 'p1' }, error: null },
      players: [
        { data: { id: 'p1', session_id: 'sess-1' }, error: null },
        { data: {}, error: null },
        { data: null, error: null, count: 1 },
      ],
      game_sessions: { data: { id: 'sess-1', status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/leave/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.roomClosed).toBe(false);
    expect(admin.lastUpdate('game_sessions')).toBeUndefined();
  });

  it('does not close a live game when a player leaves', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok', player_id: 'p1' }, error: null },
      players: [
        { data: { id: 'p1', session_id: 'sess-1' }, error: null },
        { data: {}, error: null },
      ],
      game_sessions: { data: { id: 'sess-1', status: 'question_active' }, error: null },
    });
    const { POST } = await import('@/app/api/player/leave/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.roomClosed).toBe(false);
    expect(admin.lastUpdate('game_sessions')).toBeUndefined();
  });
});
