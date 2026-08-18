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

  it('returns 404 when the room does not exist', async () => {
    admin.setTable('game_sessions', { data: null, error: null });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result).toMatchObject({ status: 404, body: { error: 'Game room not found.' } });
  });

  it('rejects a finished room', async () => {
    admin.setTable('game_sessions', { data: { ...lobbySession, status: 'finished' }, error: null });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/finished/);
  });

  it('blocks new joins after the lobby and reports GAME_STARTED', async () => {
    admin.setTables({
      game_sessions: { data: { ...lobbySession, status: 'question_active' }, error: null },
      players: { data: null, error: null },
    });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('GAME_STARTED');
    expect(result.body.sessionId).toBe('sess-1');
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
    expect(result.body.playerId).toBe('p-existing');
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
  });

  it('returns 429 when the IP join bucket is exhausted', async () => {
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSec: 17 });
    const { POST } = await import('@/app/api/player/join/route');
    const result = await readJson(await POST(jsonRequest({ pin: '123456', nickname: 'Ada' })));
    expect(result.status).toBe(429);
    expect(result.headers.get('Retry-After')).toBe('17');
  });
});
