import { describe, expect, it } from 'vitest';
import { gradeAnswer, calculatePoints, resolveMultiplier } from '@/lib/game/scoring';

const mcq = [
  { id: 'a', text: 'A', is_correct: false },
  { id: 'b', text: 'B', is_correct: true },
];

describe('gradeAnswer', () => {
  it('grades mcq correctly', () => {
    expect(gradeAnswer({ type: 'mcq', answers: mcq, selectedAnswerIds: ['b'], isLate: false })).toBe(true);
    expect(gradeAnswer({ type: 'mcq', answers: mcq, selectedAnswerIds: ['a'], isLate: false })).toBe(false);
  });

  it('grades true_false the same way as mcq (first selected vs first correct)', () => {
    const answers = [
      { id: 't', text: 'True', is_correct: true },
      { id: 'f', text: 'False', is_correct: false },
    ];
    expect(gradeAnswer({ type: 'true_false', answers, selectedAnswerIds: ['t'], isLate: false })).toBe(true);
    expect(gradeAnswer({ type: 'true_false', answers, selectedAnswerIds: ['f'], isLate: false })).toBe(false);
  });

  it('rejects late answers even when the choice is right', () => {
    expect(gradeAnswer({ type: 'mcq', answers: mcq, selectedAnswerIds: ['b'], isLate: true })).toBe(false);
  });

  it('grades multi_select requiring the exact set regardless of order', () => {
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
    expect(
      gradeAnswer({ type: 'multi_select', answers, selectedAnswerIds: ['1', '2', '3'], isLate: false })
    ).toBe(false);
  });

  it('grades type_answer with semicolon alternatives, trim, and case-fold', () => {
    const answers = [{ id: '1', text: 'Paris;paris;PARIS', is_correct: true }];
    expect(
      gradeAnswer({ type: 'type_answer', answers, selectedAnswerIds: [' paris '], isLate: false })
    ).toBe(true);
    expect(
      gradeAnswer({ type: 'type_answer', answers, selectedAnswerIds: ['London'], isLate: false })
    ).toBe(false);
    expect(
      gradeAnswer({ type: 'type_answer', answers, selectedAnswerIds: [''], isLate: false })
    ).toBe(false);
  });

  it('never marks polls correct', () => {
    expect(gradeAnswer({ type: 'poll', answers: mcq, selectedAnswerIds: ['b'], isLate: false })).toBe(false);
  });

  it('returns false for unknown question types', () => {
    expect(gradeAnswer({ type: 'puzzle', answers: mcq, selectedAnswerIds: ['b'], isLate: false })).toBe(false);
  });

  it('returns false when mcq has no correct option configured', () => {
    const answers = [{ id: 'a', text: 'A', is_correct: false }];
    expect(gradeAnswer({ type: 'mcq', answers, selectedAnswerIds: ['a'], isLate: false })).toBe(false);
  });
});

describe('calculatePoints', () => {
  it('awards full linear base when answered instantly and starts a streak', () => {
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

  it('decays linear score by half across the full timer', () => {
    const { pointsAwarded } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'linear',
      timeTakenMs: 20000,
      timeLimitMs: 20000,
      previousStreak: 0,
      multiplier: 1,
    });
    expect(pointsAwarded).toBe(500);
  });

  it('clamps time ratio so overtime cannot go below the 50% floor before streak', () => {
    const { pointsAwarded } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'linear',
      timeTakenMs: 999999,
      timeLimitMs: 20000,
      previousStreak: 0,
      multiplier: 1,
    });
    expect(pointsAwarded).toBe(500);
  });

  it('halves linear score at the midpoint', () => {
    const { pointsAwarded } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'linear',
      timeTakenMs: 10000,
      timeLimitMs: 20000,
      previousStreak: 0,
      multiplier: 1,
    });
    expect(pointsAwarded).toBe(750);
  });

  it('applies 2x multiplier after streak bonus', () => {
    const { pointsAwarded, newStreak } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'flat',
      timeTakenMs: 1000,
      timeLimitMs: 20000,
      previousStreak: 1,
      multiplier: 2,
    });
    expect(newStreak).toBe(2);
    expect(pointsAwarded).toBe(2100);
  });

  it('caps streak bonus at 250', () => {
    const { pointsAwarded, newStreak } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'flat',
      timeTakenMs: 0,
      timeLimitMs: 20000,
      previousStreak: 20,
      multiplier: 1,
    });
    expect(newStreak).toBe(21);
    expect(pointsAwarded).toBe(1250);
  });

  it('returns zero points and broken streak when incorrect', () => {
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

  it('returns zero when late even if marked correct', () => {
    const { pointsAwarded, newStreak } = calculatePoints({
      isCorrect: true,
      isLate: true,
      pointsBase: 1000,
      scoringType: 'flat',
      timeTakenMs: 100,
      timeLimitMs: 20000,
      previousStreak: 4,
      multiplier: 2,
    });
    expect(pointsAwarded).toBe(0);
    expect(newStreak).toBe(0);
  });

  it('adds streak bonus even when scoring type is none (base is 0)', () => {
    const { pointsAwarded } = calculatePoints({
      isCorrect: true,
      isLate: false,
      pointsBase: 1000,
      scoringType: 'none',
      timeTakenMs: 0,
      timeLimitMs: 20000,
      previousStreak: 2,
      multiplier: 1,
    });
    expect(pointsAwarded).toBe(100);
  });
});

describe('resolveMultiplier', () => {
  it('uses session active multiplier first', () => {
    expect(resolveMultiplier(2, [], 'q1', 0)).toBe(2);
  });

  it('ignores any active value other than 2', () => {
    expect(resolveMultiplier(1, [], 'q1', 0)).toBe(1);
    expect(resolveMultiplier(3, [], 'q1', 0)).toBe(1);
    expect(resolveMultiplier(null, [], 'q1', 0)).toBe(1);
    expect(resolveMultiplier(undefined, [], 'q1', 0)).toBe(1);
  });

  it('does not honor empty double_points_rounds as free 2x', () => {
    expect(resolveMultiplier(1, [], 'q1', 0)).toBe(1);
  });

  it('matches configured question id or index string', () => {
    expect(resolveMultiplier(1, ['q1'], 'q1', 3)).toBe(2);
    expect(resolveMultiplier(1, ['3'], 'other', 3)).toBe(2);
    expect(resolveMultiplier(1, ['2'], 'q1', 3)).toBe(1);
  });

  it('treats a non-array double_points_rounds as empty', () => {
    expect(resolveMultiplier(1, { q1: true }, 'q1', 0)).toBe(1);
  });
});
