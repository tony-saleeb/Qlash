export function rankOfPlayer(rows: { id: string; score: number }[], playerId: string): number | null {
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const index = sorted.findIndex((row) => row.id === playerId);
  return index >= 0 ? index + 1 : null;
}

export type RankMoveKind = 'up' | 'down' | 'same';

export function rankMove(
  previous: number | null | undefined,
  current: number | null | undefined
): { current: number; delta: number; kind: RankMoveKind } | null {
  if (!current || current < 1) return null;
  if (!previous || previous < 1) {
    return { current, delta: 0, kind: 'same' };
  }
  const delta = previous - current;
  const kind: RankMoveKind = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
  return { current, delta, kind };
}
