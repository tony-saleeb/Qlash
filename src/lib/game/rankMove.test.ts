import { describe, expect, it } from 'vitest';
import { rankMove, rankOfPlayer } from '@/lib/game/rankMove';

describe('rank move', () => {
  it('ranks by score then id', () => {
    const rows = [
      { id: 'b', score: 100 },
      { id: 'a', score: 400 },
      { id: 'c', score: 100 },
    ];
    expect(rankOfPlayer(rows, 'a')).toBe(1);
    expect(rankOfPlayer(rows, 'b')).toBe(2);
    expect(rankOfPlayer(rows, 'missing')).toBeNull();
  });

  it('treats a first known rank as held', () => {
    expect(rankMove(null, 4)).toEqual({ current: 4, delta: 0, kind: 'same' });
    expect(rankMove(undefined, 0)).toBeNull();
  });

  it('computes climbs and drops', () => {
    expect(rankMove(5, 2)).toEqual({ current: 2, delta: 3, kind: 'up' });
    expect(rankMove(2, 4)).toEqual({ current: 4, delta: -2, kind: 'down' });
    expect(rankMove(3, 3)).toEqual({ current: 3, delta: 0, kind: 'same' });
  });
});
