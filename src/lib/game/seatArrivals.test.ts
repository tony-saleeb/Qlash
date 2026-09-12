import { describe, expect, it } from 'vitest';
import { seatArrivals } from '@/lib/game/seatArrivals';

describe('seatArrivals', () => {
  it('keeps the same array when nothing arrived', () => {
    const seated = [{ id: 'a' }];
    expect(seatArrivals(seated, [])).toBe(seated);
  });

  it('appends arrivals in order', () => {
    expect(seatArrivals([{ id: 'a' }], [{ id: 'b' }, { id: 'c' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
  });

  it('never seats the same player twice', () => {
    const seated = [{ id: 'a' }];
    expect(seatArrivals(seated, [{ id: 'a' }])).toBe(seated);
    expect(seatArrivals(seated, [{ id: 'b' }, { id: 'b' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('seats a full class in one merge', () => {
    const arrivals = Array.from({ length: 80 }, (_, i) => ({ id: `p${i}` }));
    expect(seatArrivals([], arrivals)).toHaveLength(80);
    expect(seatArrivals(arrivals, arrivals)).toHaveLength(80);
  });
});
