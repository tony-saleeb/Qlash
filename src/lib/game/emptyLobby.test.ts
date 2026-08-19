import { describe, expect, it } from 'vitest';
import {
  LAST_LOBBY_PLAYER_ABANDON_MS,
  connectedPlayerCount,
  isPlayerConnected,
  lobbyAbandonedOffline,
  lobbyShouldCloseNow,
} from '@/lib/game/emptyLobby';

describe('empty lobby close', () => {
  it('does not close a lobby that never had players', () => {
    expect(lobbyShouldCloseNow({ status: 'lobby', hadPlayers: false, playerCount: 0 })).toBe(false);
  });

  it('closes once the last player has left', () => {
    expect(lobbyShouldCloseNow({ status: 'lobby', hadPlayers: true, playerCount: 0 })).toBe(true);
    expect(lobbyShouldCloseNow({ status: 'lobby', hadPlayers: true, playerCount: 1 })).toBe(false);
    expect(lobbyShouldCloseNow({ status: 'question_active', hadPlayers: true, playerCount: 0 })).toBe(false);
  });

  it('treats missing connected as online', () => {
    expect(isPlayerConnected({})).toBe(true);
    expect(isPlayerConnected({ connected: undefined })).toBe(true);
    expect(isPlayerConnected({ connected: true })).toBe(true);
    expect(isPlayerConnected({ connected: false })).toBe(false);
    expect(connectedPlayerCount([{ connected: false }, {}])).toBe(1);
  });

  it('treats every disconnected lobby player as abandoned', () => {
    expect(
      lobbyAbandonedOffline({
        status: 'lobby',
        hadPlayers: true,
        playerCount: 1,
        connectedCount: 0,
      })
    ).toBe(true);
    expect(
      lobbyAbandonedOffline({
        status: 'lobby',
        hadPlayers: true,
        playerCount: 2,
        connectedCount: 0,
      })
    ).toBe(true);
    expect(
      lobbyAbandonedOffline({
        status: 'lobby',
        hadPlayers: true,
        playerCount: 2,
        connectedCount: 1,
      })
    ).toBe(false);
    expect(
      lobbyAbandonedOffline({
        status: 'lobby',
        hadPlayers: true,
        playerCount: 1,
        connectedCount: 1,
      })
    ).toBe(false);
    expect(LAST_LOBBY_PLAYER_ABANDON_MS).toBe(4_000);
  });
});
