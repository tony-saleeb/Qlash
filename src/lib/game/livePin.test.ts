import { describe, expect, it } from 'vitest';
import { randomLivePin } from '@/lib/game/livePin';

describe('randomLivePin', () => {
  it('always returns a six-digit PIN with no leading zero', () => {
    const pins = Array.from({ length: 200 }, () => randomLivePin());
    for (const pin of pins) {
      expect(pin).toMatch(/^[1-9][0-9]{5}$/);
      const value = Number(pin);
      expect(value).toBeGreaterThanOrEqual(100000);
      expect(value).toBeLessThanOrEqual(999999);
    }
  });
});
