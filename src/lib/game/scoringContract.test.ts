import { describe, expect, it } from 'vitest';
import { SERVER_LATE_CUTOFF_MS } from '@/lib/game/constants';
import { calculatePoints, gradeAnswer } from '@/lib/game/scoring';
import { SCORING_CASES } from '@/lib/game/scoringFixture';

/** Mirrors v_is_late in submit_live_answer. */
function isLate(timeTakenMs: number, timeLimitMs: number): boolean {
  return timeTakenMs > timeLimitMs + SERVER_LATE_CUTOFF_MS;
}

describe('scoring contract', () => {
  it('covers every question type and both scoring branches', () => {
    const types = new Set(SCORING_CASES.map((testCase) => testCase.type));
    expect(types).toEqual(new Set(['mcq', 'multi_select', 'type_answer', 'poll']));
    const scoringTypes = new Set(SCORING_CASES.map((testCase) => testCase.scoringType));
    expect(scoringTypes).toEqual(new Set(['linear', 'flat', 'none']));
    expect(SCORING_CASES.some((testCase) => testCase.activeMultiplier === 2)).toBe(true);
  });

  for (const testCase of SCORING_CASES) {
    it(`TypeScript grader: ${testCase.name}`, () => {
      const timeLimitMs = testCase.timeLimitSeconds * 1000;
      const late = isLate(testCase.timeTakenMs, timeLimitMs);

      const isCorrect = gradeAnswer({
        type: testCase.type,
        answers: testCase.answers,
        selectedAnswerIds: testCase.selected,
        isLate: late,
      });
      expect(isCorrect).toBe(testCase.expect.isCorrect);

      const { pointsAwarded, newStreak } = calculatePoints({
        isCorrect,
        isLate: late,
        pointsBase: testCase.pointsBase,
        scoringType: testCase.scoringType,
        timeTakenMs: testCase.timeTakenMs,
        timeLimitMs,
        previousStreak: testCase.previousStreak,
        multiplier: testCase.activeMultiplier,
      });
      expect(pointsAwarded).toBe(testCase.expect.pointsAwarded);
      expect(newStreak).toBe(testCase.expect.newStreak);
    });
  }
});
