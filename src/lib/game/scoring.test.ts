import { describe, expect, it } from 'vitest';
import { gradeAnswer, calculatePoints, resolveMultiplier } from '@/lib/game/scoring';
import { aggregateTeamScores } from '@/lib/game/teams';
import { shuffle } from '@/lib/game/shuffle';

describe('gradeAnswer', () => {
  const mcq = [
    { id: 'a', text: 'A', is_correct: false },
    { id: 'b', text: 'B', is_correct: true },
  ];

  it('grades mcq correctly', () => {
    expect(gradeAnswer({ type: 'mcq', answers: mcq, selectedAnswerIds: ['b'], isLate: false })).toBe(true);
    expect(gradeAnswer({ type: 'mcq', answers: mcq, selectedAnswerIds: ['a'], isLate: false })).toBe(false);
  });

  it('rejects late answers', () => {
    expect(gradeAnswer({ type: 'mcq', answers: mcq, selectedAnswerIds: ['b'], isLate: true })).toBe(false);
  });

  it('grades multi_select requiring exact set', () => {
    const answers = [
      { id: '1', text: '1', is_correct: true },
      { id: '2', text: '2', is_correct: true },
      { id: '3', text: '3', is_correct: false },
    ];
    expect(
      gradeAnswer({ type: 'multi_select', answers, selectedAnswerIds: ['2', '1'], isLate: false })
    ).toBe(true);
    expect(
      gradeAnswer({ type: 'multi_select', answers, selectedAnswerIds: ['1'], isLate: false })
    ).toBe(false);
  });

  it('grades type_answer with semicolon alternatives', () => {
    const answers = [{ id: '1', text: 'Paris;paris;PARIS', is_correct: true }];
    expect(
      gradeAnswer({ type: 'type_answer', answers, selectedAnswerIds: [' paris '], isLate: false })
    ).toBe(true);
    expect(
      gradeAnswer({ type: 'type_answer', answers, selectedAnswerIds: ['London'], isLate: false })
    ).toBe(false);
  });

  it('never marks polls correct', () => {
    expect(gradeAnswer({ type: 'poll', answers: mcq, selectedAnswerIds: ['b'], isLate: false })).toBe(false);
  });
});

describe('calculatePoints', () => {
  it('applies linear decay and streak bonus', () => {
    const { pointsAwarded, newStreak } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'linear',
      timeTakenMs: 0,
      timeLimitMs: 20000,
      previousStreak: 0,
      multiplier: 1,
    });
    expect(newStreak).toBe(1);
    expect(pointsAwarded).toBe(1000);
  });

  it('applies 2x multiplier', () => {
    const { pointsAwarded } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'flat',
      timeTakenMs: 1000,
      timeLimitMs: 20000,
      previousStreak: 0,
      multiplier: 2,
    });
    expect(pointsAwarded).toBe(2000);
  });

  it('returns zero when incorrect', () => {
    const { pointsAwarded, newStreak } = calculatePoints({
      isCorrect: false,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'flat',
      timeTakenMs: 100,
      timeLimitMs: 20000,
      previousStreak: 3,
      multiplier: 2,
    });
    expect(pointsAwarded).toBe(0);
    expect(newStreak).toBe(0);
  });
});

describe('resolveMultiplier', () => {
  it('uses session active multiplier first', () => {
    expect(resolveMultiplier(2, [], 'q1', 0)).toBe(2);
  });

  it('does not honor empty double_points_rounds as free 2x', () => {
    expect(resolveMultiplier(1, [], 'q1', 0)).toBe(1);
  });

  it('matches configured question id or index', () => {
    expect(resolveMultiplier(1, ['q1'], 'q1', 3)).toBe(2);
    expect(resolveMultiplier(1, ['3'], 'other', 3)).toBe(2);
  });
});

describe('aggregateTeamScores', () => {
  it('sums scores by team', () => {
    const rows = aggregateTeamScores([
      { id: '1', session_id: 's', nickname: 'A', team_name: 'Red', score: 100, streak: 0, joined_at: '', connected: true },
      { id: '2', session_id: 's', nickname: 'B', team_name: 'Red', score: 50, streak: 0, joined_at: '', connected: true },
      { id: '3', session_id: 's', nickname: 'C', team_name: 'Blue', score: 200, streak: 0, joined_at: '', connected: true },
    ]);
    expect(rows[0]).toMatchObject({ team_name: 'Blue', score: 200, members: 1 });
    expect(rows[1]).toMatchObject({ team_name: 'Red', score: 150, members: 2 });
  });
});

describe('shuffle', () => {
  it('preserves elements', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out.sort()).toEqual(input);
    expect(out).not.toBe(input);
  });
});
