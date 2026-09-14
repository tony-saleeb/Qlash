/**
 * The scoring contract. Both graders must produce these numbers:
 *   - public.submit_live_answer (schema-fast-submit.sql) — canonical, grades live
 *   - src/lib/game/scoring.ts — the TypeScript mirror used for provisional UI
 *
 * scoringContract.test.ts asserts the TypeScript side on every run.
 * scripts/verify-scoring.sql replays the same cases through the real RPC.
 * A case may only change when both sides change with it.
 */

export interface ScoringCase {
  /** Matches the case name printed by the SQL verifier. */
  name: string;
  type: 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll';
  answers: { id: string; text: string; is_correct: boolean }[];
  selected: string[];
  timeTakenMs: number;
  timeLimitSeconds: number;
  pointsBase: number;
  scoringType: 'linear' | 'flat' | 'none';
  previousStreak: number;
  activeMultiplier: 1 | 2;
  expect: { isCorrect: boolean; pointsAwarded: number; newStreak: number };
}

const MCQ = [
  { id: '1', text: 'Cairo', is_correct: false },
  { id: '2', text: 'Alexandria', is_correct: true },
];

export const SCORING_CASES: ScoringCase[] = [
  {
    name: 'mcq instant answer takes full base',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 0,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'linear',
    previousStreak: 0,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 1000, newStreak: 1 },
  },
  {
    name: 'mcq at half the clock decays to 75 percent and adds a streak bonus',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 10_000,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'linear',
    previousStreak: 2,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 850, newStreak: 3 },
  },
  {
    name: 'mcq on the final tick floors at half base',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 20_000,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'linear',
    previousStreak: 0,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 500, newStreak: 1 },
  },
  {
    name: 'wrong mcq scores nothing and breaks the streak',
    type: 'mcq',
    answers: MCQ,
    selected: ['1'],
    timeTakenMs: 3_000,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'linear',
    previousStreak: 4,
    activeMultiplier: 1,
    expect: { isCorrect: false, pointsAwarded: 0, newStreak: 0 },
  },
  {
    name: 'an answer inside the 1500ms grace still counts',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 21_000,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'linear',
    previousStreak: 5,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 750, newStreak: 6 },
  },
  {
    name: 'an answer past the grace is late, still correct, and scores nothing',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 21_501,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'linear',
    previousStreak: 5,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 0, newStreak: 0 },
  },
  {
    name: 'multi_select accepts the exact set in any order',
    type: 'multi_select',
    answers: [
      { id: '1', text: 'Tout', is_correct: true },
      { id: '2', text: 'Baba', is_correct: true },
      { id: '3', text: 'Kiahk', is_correct: false },
    ],
    selected: ['2', '1'],
    timeTakenMs: 0,
    timeLimitSeconds: 30,
    pointsBase: 800,
    scoringType: 'linear',
    previousStreak: 0,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 800, newStreak: 1 },
  },
  {
    name: 'multi_select rejects a partial set',
    type: 'multi_select',
    answers: [
      { id: '1', text: 'Tout', is_correct: true },
      { id: '2', text: 'Baba', is_correct: true },
      { id: '3', text: 'Kiahk', is_correct: false },
    ],
    selected: ['1'],
    timeTakenMs: 0,
    timeLimitSeconds: 30,
    pointsBase: 800,
    scoringType: 'linear',
    previousStreak: 1,
    activeMultiplier: 1,
    expect: { isCorrect: false, pointsAwarded: 0, newStreak: 0 },
  },
  {
    name: 'type_answer folds case, trims, and accepts a semicolon alternative',
    type: 'type_answer',
    answers: [{ id: '1', text: 'Nayrouz;النيروز', is_correct: true }],
    selected: ['  NAYROUZ '],
    timeTakenMs: 4_000,
    timeLimitSeconds: 25,
    pointsBase: 500,
    scoringType: 'flat',
    previousStreak: 0,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 500, newStreak: 1 },
  },
  {
    name: 'type_answer accepts the Arabic alternative',
    type: 'type_answer',
    answers: [{ id: '1', text: 'Nayrouz;النيروز', is_correct: true }],
    selected: ['النيروز'],
    timeTakenMs: 4_000,
    timeLimitSeconds: 25,
    pointsBase: 500,
    scoringType: 'flat',
    previousStreak: 0,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 500, newStreak: 1 },
  },
  {
    name: 'a poll is never correct and never scores',
    type: 'poll',
    answers: [
      { id: '1', text: 'Yes', is_correct: false },
      { id: '2', text: 'No', is_correct: false },
    ],
    selected: ['1'],
    timeTakenMs: 1_000,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'none',
    previousStreak: 3,
    activeMultiplier: 1,
    expect: { isCorrect: false, pointsAwarded: 0, newStreak: 0 },
  },
  {
    name: 'scoring_type none still pays the streak bonus',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 0,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'none',
    previousStreak: 2,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 100, newStreak: 3 },
  },
  {
    name: 'double points applies after the streak bonus',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 1_000,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'flat',
    previousStreak: 1,
    activeMultiplier: 2,
    expect: { isCorrect: true, pointsAwarded: 2100, newStreak: 2 },
  },
  {
    name: 'streak bonus caps at 250',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 0,
    timeLimitSeconds: 20,
    pointsBase: 1000,
    scoringType: 'flat',
    previousStreak: 20,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 1250, newStreak: 21 },
  },
  {
    name: 'a missing time limit pays full base instead of decaying',
    type: 'mcq',
    answers: MCQ,
    selected: ['2'],
    timeTakenMs: 0,
    timeLimitSeconds: 0,
    pointsBase: 1000,
    scoringType: 'linear',
    previousStreak: 0,
    activeMultiplier: 1,
    expect: { isCorrect: true, pointsAwarded: 1000, newStreak: 1 },
  },
];
