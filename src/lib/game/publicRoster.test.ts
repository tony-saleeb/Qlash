import { describe, expect, it } from 'vitest';
import { publicRoster } from '@/lib/game/publicRoster';

describe('publicRoster', () => {
  it('marks the caller and omits every player id', () => {
    const rows = publicRoster(
      [
        { id: 'p1', nickname: 'Ada', score: 900, streak: 1, connected: true, team_name: 'Red' },
        { id: 'p2', nickname: 'Bob', score: 100, streak: 0, connected: true, team_name: 'Blue' },
      ],
      'p1'
    );
    expect(rows[0]).toEqual({
      nickname: 'Ada',
      score: 900,
      streak: 1,
      connected: true,
      team_name: 'Red',
      isMe: true,
    });
    expect(rows[1].isMe).toBe(false);
    expect(rows[1]).not.toHaveProperty('id');
  });
});