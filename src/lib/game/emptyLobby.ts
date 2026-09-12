/** Treat missing connected as online — INSERT payloads may omit the flag. */
export function isPlayerConnected(player: { connected?: boolean | null }): boolean {
  return player.connected !== false;
}

export function connectedPlayerCount(players: { connected?: boolean | null }[]): number {
  return players.filter(isPlayerConnected).length;
}

/**
 * Close an occupied lobby only when the last player row is gone (Quit or kick).
 * Offline players do not seal a room: a locked phone or an app switch reports
 * connected=false, and a whole class waiting with dark screens is normal.
 */
export function lobbyShouldCloseNow(params: {
  status: string;
  hadPlayers: boolean;
  playerCount: number;
}): boolean {
  return params.status === 'lobby' && params.hadPlayers && params.playerCount === 0;
}
