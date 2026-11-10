import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

describe('POST /api/player/connection', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('requires identity and a boolean connected flag', async () => {
    const { POST } = await import('@/app/api/player/connection/route');
    expect((await readJson(await POST(jsonRequest({ playerId: 'p1', token: 'tok' })))).status).toBe(400);
    expect(
      (await readJson(await POST(jsonRequest({ playerId: 'p1', token: 'tok', connected: 'false' })))).status
    ).toBe(400);
  });

  it('rejects a token that does not match and a failed presence write', async () => {
    const { POST } = await import('@/app/api/player/connection/route');
    admin.setTables({
      player_tokens: { data: { client_token: 'other', player_id: 'p1' }, error: null },
    });
    expect(
      (await readJson(await POST(jsonRequest({ playerId: 'p1', token: 'tok', connected: false })))).status
    ).toBe(401);

    admin.setTables({
      player_tokens: { data: { client_token: 'tok', player_id: 'p1' }, error: null },
      players: { data: null, error: { message: 'write failed' } },
    });
    expect(
      (await readJson(await POST(jsonRequest({ playerId: 'p1', token: 'tok', connected: true })))).status
    ).toBe(500);
  });

  it('marks the player offline when the token matches', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: {}, error: null },
    });
    const { POST } = await import('@/app/api/player/connection/route');
    const result = await readJson(
      await POST(jsonRequest({ playerId: 'p1', token: 'tok', connected: false }))
    );
    expect(result.status).toBe(200);
    expect(admin.lastUpdate('players')).toEqual({ connected: false });
  });
});
