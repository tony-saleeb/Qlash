import { describe, expect, it } from 'vitest';
import {
  connectedPlayerCount,
  isPlayerConnected,
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

  it('keeps a full lobby open when every phone is asleep', () => {
    expect(
      lobbyShouldCloseNow({ status: 'lobby', hadPlayers: true, playerCount: 80 })
    ).toBe(false);
    expect(connectedPlayerCount(Array.from({ length: 80 }, () => ({ connected: false })))).toBe(0);
  });
});
