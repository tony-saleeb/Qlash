import { describe, expect, it } from 'vitest';
import { aggregateTeamScores } from '@/lib/game/teams';
import type { Player } from '@/lib/game/types';

function player(partial: Partial<Player> & Pick<Player, 'id' | 'nickname' | 'score'>): Player {
  return {
    session_id: 's',
    streak: 0,
    joined_at: '',
    connected: true,
    team_name: null,
    ...partial,
  };
}

describe('aggregateTeamScores', () => {
  it('sums scores by team and sorts descending', () => {
    const rows = aggregateTeamScores([
      player({ id: '1', nickname: 'A', team_name: 'Red', score: 100 }),
      player({ id: '2', nickname: 'B', team_name: 'Red', score: 50 }),
      player({ id: '3', nickname: 'C', team_name: 'Blue', score: 200 }),
    ]);
    expect(rows[0]).toMatchObject({ team_name: 'Blue', score: 200, members: 1, topPlayer: 'C' });
    expect(rows[1]).toMatchObject({ team_name: 'Red', score: 150, members: 2, topPlayer: 'A' });
  });

  it('ignores empty or whitespace-only team names', () => {
    const rows = aggregateTeamScores([
      player({ id: '1', nickname: 'Solo', team_name: '  ', score: 900 }),
      player({ id: '2', nickname: 'None', team_name: null, score: 800 }),
      player({ id: '3', nickname: 'Named', team_name: 'Alpha', score: 10 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].team_name).toBe('Alpha');
  });

  it('trims team names and tracks the highest individual as topPlayer', () => {
    const rows = aggregateTeamScores([
      player({ id: '1', nickname: 'Low', team_name: '  Wolves ', score: 10 }),
      player({ id: '2', nickname: 'High', team_name: 'Wolves', score: 40 }),
      player({ id: '3', nickname: 'Mid', team_name: 'Wolves', score: 25 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      team_name: 'Wolves',
      score: 75,
      members: 3,
      topPlayer: 'High',
    });
  });
});
