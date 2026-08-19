import { describe, expect, it } from 'vitest';
import { CLASH_BEATS, clashBeatLabel, CLASH_TOTAL_MS } from '@/lib/game/clashCountdown';

describe('clash countdown', () => {
  it('counts 3-2-1 then the clash word', () => {
    expect(CLASH_BEATS).toEqual([3, 2, 1, 0]);
    expect(clashBeatLabel(3, 'CLASH')).toBe('3');
    expect(clashBeatLabel(0, 'قلاش')).toBe('قلاش');
    expect(CLASH_TOTAL_MS).toBe(3000);
  });
});
