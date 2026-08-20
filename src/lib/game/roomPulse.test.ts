import { describe, expect, it } from 'vitest';
import {
  FIRST_LOCK_BANNER_MS,
  answerPulsePercent,
  hottestStreak,
  isRoomLocked,
  shouldAnnounceFirstLock,
} from '@/lib/game/roomPulse';

describe('room pulse', () => {
  it('maps answered/total to a percent', () => {
    expect(answerPulsePercent(0, 8)).toBe(0);
    expect(answerPulsePercent(2, 8)).toBe(25);
    expect(answerPulsePercent(8, 8)).toBe(100);
    expect(answerPulsePercent(3, 0)).toBe(0);
  });

  it('announces only the first lock of a round', () => {
    expect(shouldAnnounceFirstLock(0, 1)).toBe(true);
    expect(shouldAnnounceFirstLock(1, 2)).toBe(false);
    expect(shouldAnnounceFirstLock(0, 0)).toBe(false);
  });

  it('knows when every seat has locked', () => {
    expect(isRoomLocked(8, 8)).toBe(true);
    expect(isRoomLocked(7, 8)).toBe(false);
    expect(isRoomLocked(0, 0)).toBe(false);
    expect(FIRST_LOCK_BANNER_MS).toBeGreaterThan(2000);
  });

  it('picks the hottest streak of 2+', () => {
    expect(hottestStreak([{ streak: 1 }, { streak: 4 }, { streak: 3 }])).toEqual({ streak: 4 });
    expect(hottestStreak([{ streak: 0 }, { streak: 1 }])).toBeNull();
  });
});
