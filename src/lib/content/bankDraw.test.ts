import { describe, expect, it } from 'vitest';
import { bankToQuestionRows, normalizeBankQuestion, pickRandom } from '@/lib/content/bankDraw';

const bank = [
  { prompt: 'One?', answers: [{ text: 'A', correct: true }, { text: 'B', correct: false }] },
  { prompt: 'Two?', answers: [{ text: 'C', correct: false }, { text: 'D', correct: true }] },
  { prompt: 'Three?', answers: [{ text: 'E', correct: true }, { text: 'F', correct: false }] },
];

describe('question bank draw', () => {
  it('picks the requested count once each', () => {
    const picked = pickRandom(bank, 2, () => 0);
    expect(picked.map((question) => question.prompt)).toEqual(['Two?', 'Three?']);
    expect(new Set(picked.map((question) => question.prompt)).size).toBe(2);
  });

  it('refuses a draw larger than the category', () => {
    expect(() => pickRandom(bank, 4, () => 0)).toThrow(/only has 3/);
  });

  it('keeps one correct answer and drops blanks', () => {
    const question = normalizeBankQuestion('  Where?  ', [
      { text: '  Cairo ', correct: true },
      { text: '   ', correct: false },
      { text: 'Alex', correct: false },
    ]);
    expect(question).toEqual({
      prompt: 'Where?',
      answers: [
        { text: 'Cairo', correct: true },
        { text: 'Alex', correct: false },
      ],
    });
    expect(() =>
      normalizeBankQuestion('Where?', [
        { text: 'Cairo', correct: true },
        { text: 'Alex', correct: true },
      ])
    ).toThrow(/one correct/);
  });

  it('maps a draw into playable multiple-choice rows', () => {
    const rows = bankToQuestionRows('quiz-1', pickRandom(bank, 1, () => 0.99));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      quiz_id: 'quiz-1',
      order_index: 0,
      type: 'mcq',
      time_limit_seconds: 20,
      points_base: 1000,
      scoring_type: 'linear',
    });
    expect(rows[0].answers.filter((answer) => answer.is_correct)).toHaveLength(1);
  });
});
