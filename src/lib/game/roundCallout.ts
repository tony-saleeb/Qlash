export type RoundCallout = 'clutch' | 'lightning' | 'streakBroken';

const LIGHTNING_REMAINING_RATIO = 0.7;

export function roundCallout(params: {
  isCorrect: boolean;
  isPoll: boolean;
  lockedRemaining: number | null;
  timeLimit: number;
  previousStreak: number;
}): RoundCallout | null {
  if (params.isPoll) return null;

  if (params.isCorrect) {
    const remaining = params.lockedRemaining ?? 0;
    if (remaining <= 3) return 'clutch';
    if (params.timeLimit > 0 && remaining / params.timeLimit >= LIGHTNING_REMAINING_RATIO) {
      return 'lightning';
    }
    return null;
  }

  if (params.previousStreak > 1) return 'streakBroken';
  return null;
}
