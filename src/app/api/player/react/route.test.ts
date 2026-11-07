import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

type RateLimitResult = { ok: boolean; retryAfterSec?: number };
type RateLimitParams = { key: string; limit: number; windowMs: number };
type ShardedParams = RateLimitParams & { seed: string };

const { rateLimitMock, shardedMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn((params: RateLimitParams): RateLimitResult => {
    void params;
    return { ok: true };
  }),
  shardedMock: vi.fn((params: ShardedParams): RateLimitResult => {
    void params;
    return { ok: true };
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (params: RateLimitParams) => rateLimitMock(params),
  rateLimitSharded: (params: ShardedParams) => shardedMock(params),
  clientIpFromRequest: () => 'test-ip',
}));

const admin = createClientMock();

const valid = { sessionId: 'sess-1', playerId: 'p1', token: 'tok', mark: 'slash' };

describe('POST /api/player/react', () => {
  beforeEach(() => {
    admin.reset();
    rateLimitMock.mockReset();
    rateLimitMock.mockReturnValue({ ok: true });
    shardedMock.mockReset();
    shardedMock.mockReturnValue({ ok: true });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('rejects a body that is missing a mark', async () => {
    const { POST } = await import('@/app/api/player/react/route');
    const response = await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }));
    expect(response.status).toBe(400);
  });

  it('rejects a bad token', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'other' }, error: null },
      players: { data: { id: 'p1', nickname: 'Ada' }, error: null },
      game_sessions: { data: { status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/react/route');
    const response = await POST(jsonRequest(valid));
    expect(response.status).toBe(401);
  });

  it('returns 404 when the player is not in this session', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: null, error: null },
      game_sessions: { data: { status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/react/route');
    const response = await POST(jsonRequest(valid));
    expect(response.status).toBe(404);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('drops a reaction when the room is not cheering', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1', nickname: 'Ada' }, error: null },
      game_sessions: { data: { status: 'question_reveal' }, error: null },
    });
    const { POST } = await import('@/app/api/player/react/route');
    const response = await POST(jsonRequest(valid));
    expect(response.status).toBe(204);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('drops a reaction when the player is rate limited', async () => {
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSec: 1 });
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1', nickname: 'Ada' }, error: null },
      game_sessions: { data: { status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/react/route');
    const response = await POST(jsonRequest(valid));
    expect(response.status).toBe(204);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('sends the nickname stored on the player row', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1', nickname: 'FromDb' }, error: null },
      game_sessions: { data: { status: 'lobby' }, error: null },
    });
    const { POST } = await import('@/app/api/player/react/route');
    const response = await POST(jsonRequest({ ...valid, nickname: 'Spoofed' }));
    expect(response.status).toBe(204);
    expect(admin.rpc).toHaveBeenCalledWith('send_lobby_reaction', {
      p_session_id: 'sess-1',
      p_mark: 'slash',
      p_nickname: 'FromDb',
    });
  });
});
