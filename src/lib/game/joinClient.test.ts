/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinOrReconnect } from '@/lib/game/joinClient';

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('joinOrReconnect', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('stores the client token on a fresh join', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          success: true,
          sessionId: 'sess-1',
          token: 'tok-fresh',
          player: { id: 'p1', nickname: 'Ada' },
        },
        200
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await joinOrReconnect({ pin: '123456', nickname: 'Ada' });
    expect(result).toEqual({ sessionId: 'sess-1', reconnected: false });
    expect(localStorage.getItem('quizarena_token_sess-1')).toBe('tok-fresh');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/join',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pin: '123456', nickname: 'Ada', teamName: undefined }),
      })
    );
  });

  it('reconnects on 409 when this device already has a token', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'old-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: 'taken', code: 'NICKNAME_TAKEN' }, 409)
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, player: { id: 'p1' } }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await joinOrReconnect({ pin: '123456', nickname: 'Ada' });
    expect(result).toEqual({ sessionId: 'sess-1', reconnected: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/player/me',
      expect.objectContaining({
        body: JSON.stringify({ sessionId: 'sess-1', token: 'old-token', nickname: 'Ada' }),
      })
    );
  });

  it('throws when nickname is taken and this device has no token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ code: 'NICKNAME_TAKEN' }, 409))
    );
    await expect(joinOrReconnect({ pin: '123456', nickname: 'Ada' })).rejects.toThrow(
      'Nickname already taken in this room.'
    );
  });

  it('reconnects mid-game when GAME_STARTED and a local token exists', async () => {
    localStorage.setItem('quizarena_token_sess-9', 'live-token');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ code: 'GAME_STARTED', error: 'started' }, 403))
        .mockResolvedValueOnce(jsonResponse({ success: true }, 200))
    );
    await expect(joinOrReconnect({ pin: '999999', nickname: 'Ada' })).resolves.toEqual({
      sessionId: 'sess-9',
      reconnected: true,
    });
  });

  it('rejects GAME_STARTED when there is no local token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ code: 'GAME_STARTED', error: 'This game has already started.' }, 403)
      )
    );
    await expect(joinOrReconnect({ pin: '999999', nickname: 'Ada' })).rejects.toThrow(
      'This game has already started.'
    );
  });

  it('rejects a full room', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ code: 'ROOM_FULL', error: 'This room is full (80 players max).' }, 403)
      )
    );
    await expect(joinOrReconnect({ pin: '123456', nickname: 'Ada' })).rejects.toThrow(
      'This room is full (80 players max).'
    );
  });

  it('surfaces a generic join failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'Invalid PIN.' }, 400))
    );
    await expect(joinOrReconnect({ pin: '12', nickname: 'Ada' })).rejects.toThrow('Invalid PIN.');
  });
});
