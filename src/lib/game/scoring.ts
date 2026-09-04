/**
 * Test-only mirror of submit_live_answer in schema-fast-submit.sql.
 * Live grading is the SQL RPC. Do not import this from submit or the live clients.
 * Keep the formulas in lockstep by eye until both sides share one fixture.
 */
export type ScoringType = 'linear' | 'flat' | 'none' | string;

export interface AnswerOptionLike {
  id: string;
  text: string;
  is_correct?: boolean;
}

export function gradeAnswer(params: {
  type: string;
  answers: AnswerOptionLike[];
  selectedAnswerIds: string[];
  isLate: boolean;
}): boolean {
  const { type, answers, selectedAnswerIds, isLate } = params;
  if (isLate) return false;

  const correctOptions = answers.filter((ans) => ans.is_correct);

  if (type === 'poll') return false;

  if (type === 'mcq' || type === 'true_false') {
    return selectedAnswerIds[0] === correctOptions[0]?.id;
  }

  if (type === 'multi_select') {
    const correctIds = correctOptions.map((opt) => opt.id).sort();
    const submittedIds = [...selectedAnswerIds].sort();
    return (
      correctIds.length === submittedIds.length &&
      correctIds.every((id, idx) => id === submittedIds[idx])
    );
  }

  if (type === 'type_answer') {
    const submittedText = (selectedAnswerIds[0] || '').trim().toLowerCase();
    const correctAlternatives = (correctOptions[0]?.text || '')
      .split(';')
      .map((t) => t.trim().toLowerCase());
    return correctAlternatives.includes(submittedText);
  }

  return false;
}

export function calculatePoints(params: {
  isCorrect: boolean;
  isLate: boolean;
  pointsBase: number;
  scoringType: ScoringType;
  timeTakenMs: number;
  timeLimitMs: number;
  previousStreak: number;
  multiplier: number;
}): { pointsAwarded: number; newStreak: number } {
  const {
    isCorrect,
    isLate,
    pointsBase,
    scoringType,
    timeTakenMs,
    timeLimitMs,
    previousStreak,
    multiplier,
  } = params;

  if (!isCorrect || isLate) {
    return { pointsAwarded: 0, newStreak: 0 };
  }

  const newStreak = previousStreak + 1;
  let pointsAwarded = 0;

  if (scoringType === 'linear') {
    const ratio = Math.max(0, Math.min(1, timeTakenMs / timeLimitMs));
    const decay = 1 - 0.5 * ratio;
    pointsAwarded = Math.round(pointsBase * decay);
  } else if (scoringType === 'flat') {
    pointsAwarded = pointsBase;
  } else {
    pointsAwarded = 0;
  }

  const streakBonus = Math.min(250, (newStreak - 1) * 50);
  pointsAwarded += streakBonus;
  pointsAwarded = Math.round(pointsAwarded * multiplier);

  return { pointsAwarded, newStreak };
}

export function resolveMultiplier(
  activeMultiplier: number | null | undefined,
  doublePointsRounds: unknown,
  questionId: string,
  currentIndex: number
): number {
  if (activeMultiplier === 2) return 2;

  const doubleRounds = Array.isArray(doublePointsRounds)
    ? (doublePointsRounds as string[])
    : [];

  if (
    doubleRounds.includes(questionId) ||
    doubleRounds.includes(String(currentIndex))
  ) {
    return 2;
  }

  return 1;
}
