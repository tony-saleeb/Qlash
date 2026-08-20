import { describe, expect, it } from 'vitest';
import { roundCallout } from '@/lib/game/roundCallout';

describe('round callout', () => {
  it('skips polls', () => {
    expect(
      roundCallout({
        isCorrect: true,
        isPoll: true,
        lockedRemaining: 2,
        timeLimit: 20,
        previousStreak: 4,
      })
    ).toBeNull();
  });

  it('prefers clutch over lightning at the buzzer', () => {
    expect(
      roundCallout({
        isCorrect: true,
        isPoll: false,
        lockedRemaining: 2,
        timeLimit: 20,
        previousStreak: 1,
      })
    ).toBe('clutch');
  });

  it('calls lightning on a fast correct lock', () => {
    expect(
      roundCallout({
        isCorrect: true,
        isPoll: false,
        lockedRemaining: 16,
        timeLimit: 20,
        previousStreak: 1,
      })
    ).toBe('lightning');
  });

  it('flags a broken streak on a miss', () => {
    expect(
      roundCallout({
        isCorrect: false,
        isPoll: false,
        lockedRemaining: 10,
        timeLimit: 20,
        previousStreak: 3,
      })
    ).toBe('streakBroken');
    expect(
      roundCallout({
        isCorrect: false,
        isPoll: false,
        lockedRemaining: 10,
        timeLimit: 20,
        previousStreak: 1,
      })
    ).toBeNull();
  });
});
