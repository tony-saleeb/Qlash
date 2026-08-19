import { describe, expect, it } from 'vitest';
import {
  LAST_LOBBY_PLAYER_ABANDON_MS,
  lobbyAbandonedByLastPlayer,
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

  it('treats a solo disconnected lobby player as abandoned', () => {
    expect(
      lobbyAbandonedByLastPlayer({
        status: 'lobby',
        hadPlayers: true,
        playerCount: 1,
        connectedCount: 0,
      })
    ).toBe(true);
    expect(
      lobbyAbandonedByLastPlayer({
        status: 'lobby',
        hadPlayers: true,
        playerCount: 1,
        connectedCount: 1,
      })
    ).toBe(false);
    expect(
      lobbyAbandonedByLastPlayer({
        status: 'lobby',
        hadPlayers: true,
        playerCount: 2,
        connectedCount: 0,
      })
    ).toBe(false);
    expect(LAST_LOBBY_PLAYER_ABANDON_MS).toBeGreaterThan(3000);
  });
});
