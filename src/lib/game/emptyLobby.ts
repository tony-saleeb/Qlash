/** Treat missing connected as online — INSERT payloads may omit the flag. */
export function isPlayerConnected(player: { connected?: boolean | null }): boolean {
  return player.connected !== false;
}

export function connectedPlayerCount(players: { connected?: boolean | null }[]): number {
  return players.filter(isPlayerConnected).length;
}

/** Close an occupied lobby as soon as the last player row is gone. */
export function lobbyShouldCloseNow(params: {
  status: string;
  hadPlayers: boolean;
  playerCount: number;
}): boolean {
  return params.status === 'lobby' && params.hadPlayers && params.playerCount === 0;
}

/**
 * Lobby players went offline (closed the tab). Wait this long before
 * closing so a refresh can reconnect.
 */
export const LAST_LOBBY_PLAYER_ABANDON_MS = 4_000;

/** True when everyone who joined the lobby is no longer connected. */
export function lobbyAbandonedOffline(params: {
  status: string;
  hadPlayers: boolean;
  playerCount: number;
  connectedCount: number;
}): boolean {
  return (
    params.status === 'lobby' &&
    params.hadPlayers &&
    params.playerCount > 0 &&
    params.connectedCount === 0
  );
}
