/** Close an occupied lobby as soon as the last player row is gone. */
export function lobbyShouldCloseNow(params: {
  status: string;
  hadPlayers: boolean;
  playerCount: number;
}): boolean {
  return params.status === 'lobby' && params.hadPlayers && params.playerCount === 0;
}

/**
 * Solo lobby player went offline (closed the tab). Wait this long before
 * closing so a refresh can reconnect.
 */
export const LAST_LOBBY_PLAYER_ABANDON_MS = 12_000;

/** True when the only person who joined the lobby is no longer connected. */
export function lobbyAbandonedByLastPlayer(params: {
  status: string;
  hadPlayers: boolean;
  playerCount: number;
  connectedCount: number;
}): boolean {
  return (
    params.status === 'lobby' &&
    params.hadPlayers &&
    params.playerCount === 1 &&
    params.connectedCount === 0
  );
}
