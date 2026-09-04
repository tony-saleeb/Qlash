/**
 * Join lobby or reconnect an existing device session.
 * Handles NICKNAME_TAKEN / mid-game reconnect via /api/player/me.
 */
export async function joinOrReconnect(params: {
  pin: string;
  nickname: string;
  teamName?: string;
}): Promise<{ sessionId: string; reconnected: boolean }> {
  const joinRes = await fetch('/api/player/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pin: params.pin,
      nickname: params.nickname,
      teamName: params.teamName,
    }),
  });
  const joinData = await joinRes.json();

  const tryReconnect = async (sessionId: string) => {
    const existingToken = localStorage.getItem(`quizarena_token_${sessionId}`);
    if (!existingToken) return false;
    const meRes = await fetch('/api/player/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        token: existingToken,
        nickname: params.nickname,
      }),
    });
    return meRes.ok;
  };

  const sessionIdsWithTokens = () =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('quizarena_token_'))
      .map((key) => key.slice('quizarena_token_'.length));

  if (joinRes.status === 409 && joinData.sessionId) {
    if (await tryReconnect(joinData.sessionId)) {
      return { sessionId: joinData.sessionId, reconnected: true };
    }
    throw new Error('Nickname already taken in this room.');
  }

  // Mid-game: reconnect from a token this device already holds. Do not require sessionId in the 403.
  if (joinRes.status === 403 && joinData.code === 'GAME_STARTED') {
    const candidates = [
      typeof joinData.sessionId === 'string' ? joinData.sessionId : '',
      ...sessionIdsWithTokens(),
    ].filter(Boolean);
    for (const sessionId of [...new Set(candidates)]) {
      if (await tryReconnect(sessionId)) {
        return { sessionId, reconnected: true };
      }
    }
    throw new Error(joinData.error || 'This game has already started.');
  }

  if (joinRes.status === 403 && joinData.code === 'ROOM_FULL') {
    throw new Error(joinData.error || 'This room is full.');
  }

  if (!joinRes.ok) {
    throw new Error(joinData.error || 'Failed to join game room.');
  }

  localStorage.setItem(`quizarena_token_${joinData.sessionId}`, joinData.token);
  return { sessionId: joinData.sessionId, reconnected: false };
}
