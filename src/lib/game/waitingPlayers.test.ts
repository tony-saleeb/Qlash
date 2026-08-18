import { describe, expect, it } from 'vitest';
import { waitingPlayers } from '@/lib/game/waitingPlayers';

describe('waitingPlayers', () => {
  it('returns players who have not submitted', () => {
    const players = [
      { id: 'a', nickname: 'Ada' },
      { id: 'b', nickname: 'Ben' },
      { id: 'c', nickname: 'Cara' },
    ];
    expect(waitingPlayers(players, ['b']).map((p) => p.id)).toEqual(['a', 'c']);
    expect(waitingPlayers(players, new Set(['a', 'b', 'c']))).toEqual([]);
  });
});
