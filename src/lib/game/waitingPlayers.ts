export function waitingPlayers<T extends { id: string }>(
  players: readonly T[],
  answeredIds: Iterable<string>
): T[] {
  const done = answeredIds instanceof Set ? answeredIds : new Set(answeredIds);
  return players.filter((player) => !done.has(player.id));
}
