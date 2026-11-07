import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

type RateLimitResult = { ok: boolean; retryAfterSec?: number };
type RateLimitParams = { key: string; limit: number; windowMs: number };

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn((params: RateLimitParams): RateLimitResult => {
    void params;
    return { ok: true };
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (params: RateLimitParams) => rateLimitMock(params),
  clientIpFromRequest: (request: Request) => request.headers.get('x-forwarded-for') || 'test-ip',
}));

const admin = createClientMock();

const lobbySession = {
  id: 'sess-1',
  status: 'lobby',
  quiz_id: 'quiz-1',
  quizzes: { team_mode: false },
  hosts: { plan: 'pro' },
};

describe('POST /api/player/join', () => {
  beforeEach(() => {
    admin.reset();
    rateLimitMock.mockReturnValue({ ok: true });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('rejects invalid PIN and empty nickname before touching the database', async () => {
    const { POST } = await import('@/app/api/player/join/route');
    expect((await readJson(await POST(jsonRequest({ pin: '12', nickname: 'Ada' })))).status).toBe(400);
    expect((await readJson(await POST(jsonRequest({ pin: '123456', nickname: '   ' })))).status).toBe(400);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it('rejects a numeric pin, an over-long pin, and a non-string nickname', async () => {
    const { POST } = await import('@/app/api/player/join/route');
    expect((await readJson(await POST(jsonRequest({ pin: 123456, nickname: 'Ada' })))).status).toBe(400);
    expect((await readJson(await POST(jsonRequest({ pin: '1234567', nickname: 'Ada' })))).status).toBe(400);
    expect((await readJson(await POST(jsonRequest({ pin: '123456', nickname: 12 })))).status).toBe(400);
    expect((await readJson(await POST(jsonRequest({ pin: '123456', nickname: ['Ada'] })))).status).toBe(400);
    const broken = await POST(
      new Request('http://localhost/api', {
        method: 'POST',
        body: 'not-json',
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(broken.status).toBe(400);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is not JSON', async () => {
    const { POST } = await import('@/app/api/player/join/route');
    const response = await POST(
      new Request('http://localhost/api', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } })
    );
    expect(response.status).toBe(400);
    expect((await readJson(response)).body.error).toBe('The request body must be JSON.');
    expect(admin.from).not.toHaveBeenCalled();
  });

  it('returns 404 when the room does not exist', async () => {
    admin.setTable('game_sessions', { data: null, error: null });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result).toMatchObject({ status: 404, body: { error: 'Game room not found.' } });
    const sessionCall = admin.fromCalls.find((entry) => entry.table === 'game_sessions');
    const captured = (
      sessionCall?.chain as { _captured?: { method: string; args: unknown[] }[] }
    )._captured;
    expect(captured).toEqual(
      expect.arrayContaining([{ method: 'neq', args: ['status', 'finished'] }])
    );
  });

  it('rejects a finished room', async () => {
    admin.setTable('game_sessions', { data: { ...lobbySession, status: 'finished' }, error: null });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/finished/);
  });

  it('refuses a first-time player once the game has started and late join is off', async () => {
    const player = {
      id: 'p-late',
      session_id: 'sess-1',
      nickname: 'Ada',
      team_name: null,
      score: 0,
      streak: 0,
      connected: true,
    };
    admin.setTables({
      game_sessions: {
        data: {
          ...lobbySession,
          status: 'question_active',
          current_question_index: 3,
          late_join_through_index: -1,
        },
        error: null,
      },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 4 },
        { data: player, error: null },
      ],
      player_tokens: { data: {}, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('GAME_STARTED');
    expect(admin.fromCalls.some((entry) => entry.table === 'players')).toBe(false);
  });

  it('refuses a join when the host has locked the room', async () => {
    admin.setTable('game_sessions', { data: { ...lobbySession, join_locked: true }, error: null });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('JOIN_LOCKED');
  });

  it('refuses a kicked nickname and a kicked device token', async () => {
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      session_kicks: { data: { nickname: 'Ada' }, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const byName = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(byName.status).toBe(403);
    expect(byName.body.code).toBe('KICKED');

    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      session_kicks: [
        { data: null, error: null },
        { data: [{ client_token: 'old-token' }], error: null },
      ],
    });
    const byToken = await readJson(
      await POST(jsonRequest({ pin: '123456', nickname: 'Bea', priorTokens: ['old-token'] }))
    );
    expect(byToken.status).toBe(403);
    expect(byToken.body.code).toBe('KICKED');
  });

  it('allows a first-time join on a later question when late join is on', async () => {
    const player = {
      id: 'p-late',
      session_id: 'sess-1',
      nickname: 'Ada',
      team_name: null,
      score: 0,
      streak: 0,
      connected: true,
    };
    admin.setTables({
      game_sessions: {
        data: {
          ...lobbySession,
          status: 'question_active',
          current_question_index: 8,
          late_join_through_index: 2,
        },
        error: null,
      },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 4 },
        { data: player, error: null },
      ],
      player_tokens: { data: {}, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.player.id).toBe('p-late');
  });

  it('refuses a room that has been open for more than 12 hours', async () => {
    admin.setTable('game_sessions', {
      data: { ...lobbySession, created_at: '2020-01-01T00:00:00.000Z' },
      error: null,
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('ROOM_EXPIRED');
    expect(admin.fromCalls.some((entry) => entry.table === 'players')).toBe(false);
  });

  it('returns NICKNAME_TAKEN in lobby so the client can reconnect', async () => {
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      players: { data: { id: 'p-existing' }, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('NICKNAME_TAKEN');
    expect(result.body.playerId).toBeUndefined();
    expect(result.body.sessionId).toBe('sess-1');
  });

  it('requires a team name on team quizzes', async () => {
    admin.setTable('game_sessions', {
      data: { ...lobbySession, quizzes: { team_mode: true } },
      error: null,
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Team name/);
  });

  it('rejects a full lobby', async () => {
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 80 },
      ],
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('ROOM_FULL');
  });

  it('lets the 80th player in when 79 are already seated', async () => {
    const player = {
      id: 'p-80',
      session_id: 'sess-1',
      nickname: 'Zed',
      team_name: null,
      score: 0,
      streak: 0,
      connected: true,
    };
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 79 },
        { data: player, error: null },
      ],
      player_tokens: { data: {}, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Zed' })));
    expect(result.status).toBe(200);
    expect(result.body.player.id).toBe('p-80');
  });

  it('inserts the player, stores a token, and returns both', async () => {
    const player = {
      id: 'p1',
      session_id: 'sess-1',
      nickname: 'Ada Lovelace',
      team_name: null,
      score: 0,
      streak: 0,
      connected: true,
    };
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 3 },
        { data: player, error: null },
      ],
      player_tokens: { data: {}, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(
      await POST(jsonRequest({ pin: '123456', nickname: '  Ada Lovelace  ' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.sessionId).toBe('sess-1');
    expect(result.body.player.nickname).toBe('Ada Lovelace');
    expect(result.body.token).toEqual(expect.any(String));
    expect(admin.lastInsert('players')).toMatchObject({
      session_id: 'sess-1',
      nickname: 'Ada Lovelace',
      team_name: null,
      connected: true,
    });
  });

  it('stores a nickname with its invisible characters removed', async () => {
    const player = {
      id: 'p1',
      session_id: 'sess-1',
      nickname: 'Ada',
      team_name: null,
      score: 0,
      streak: 0,
      connected: true,
    };
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 1 },
        { data: player, error: null },
      ],
      player_tokens: { data: {}, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(
      await POST(jsonRequest({ pin: '123456', nickname: `\u202EAda${'\u200B'}` }))
    );
    expect(result.status).toBe(200);
    expect(admin.lastInsert('players')).toMatchObject({ nickname: 'Ada' });
  });

  it('rejects a team name that is not text', async () => {
    admin.setTable('game_sessions', {
      data: { ...lobbySession, quizzes: { team_mode: true } },
      error: null,
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(
      await POST(jsonRequest({ pin: '123456', nickname: 'Ada', teamName: 12 }))
    );
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Team name/);
    expect(admin.fromCalls.some((entry) => entry.table === 'players')).toBe(false);
  });

  it('maps a capacity trigger to ROOM_FULL', async () => {
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 3 },
        { data: null, error: { code: 'P0001', message: 'ROOM_FULL' } },
      ],
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('ROOM_FULL');
  });

  it('maps a unique-nickname race to 409', async () => {
    admin.setTables({
      game_sessions: { data: lobbySession, error: null },
      players: [
        { data: null, error: null },
        { data: null, error: null, count: 1 },
        { data: null, error: { code: '23505', message: 'duplicate' } },
      ],
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('NICKNAME_TAKEN');
    expect(result.body.sessionId).toBe('sess-1');
  });

  it('returns 429 when this room is taking joins too fast', async () => {
    admin.setTable('game_sessions', { data: lobbySession, error: null });
    rateLimitMock.mockReturnValueOnce({ ok: true }).mockReturnValueOnce({ ok: false, retryAfterSec: 4 });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(429);
    expect(result.headers.get('Retry-After')).toBe('4');
    const keys = rateLimitMock.mock.calls.slice(-2).map((call) => call[0].key);
    expect(keys).toEqual(['join:test-ip', 'join:session:sess-1']);
    expect(admin.fromCalls.some((entry) => entry.table === 'players')).toBe(false);
  });

  it('returns 429 when the IP join bucket is exhausted', async () => {
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSec: 17 });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(429);
    expect(result.headers.get('Retry-After')).toBe('17');
  });
});
