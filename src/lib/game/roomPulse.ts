export const FIRST_LOCK_BANNER_MS = 3_200;

export function answerPulsePercent(answered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((answered / total) * 100)));
}

export function shouldAnnounceFirstLock(prevCount: number, nextCount: number): boolean {
  return prevCount === 0 && nextCount === 1;
}

export function isRoomLocked(answered: number, total: number): boolean {
  return total > 0 && answered >= total;
}

export function hottestStreak<T extends { streak: number }>(players: readonly T[]): T | null {
  let best: T | null = null;
  for (const player of players) {
    if (player.streak < 2) continue;
    if (!best || player.streak > best.streak) best = player;
  }
  return best;
}
