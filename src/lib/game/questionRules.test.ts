import { describe, expect, it } from 'vitest';
import { assertPlayableQuestions, questionIssue, type PlayableQuestion } from '@/lib/game/questionRules';

function mcq(overrides: Partial<PlayableQuestion> = {}): PlayableQuestion {
  return {
    type: 'mcq',
    time_limit_seconds: 20,
    points_base: 1000,
    answers: [
      { text: 'Cairo', is_correct: true },
      { text: 'Giza', is_correct: false },
    ],
    ...overrides,
  };
}

describe('questionIssue', () => {
  it('requires exactly one correct answer on multiple choice and true/false', () => {
    expect(questionIssue(mcq({
      answers: [
        { text: 'Cairo', is_correct: true },
        { text: 'Giza', is_correct: true },
      ],
    }), 0)).toMatch(/exactly one correct/);
    expect(questionIssue(mcq({ type: 'true_false' }), 2)).toBeNull();
  });

  it('requires a real key for type-answer and at least one correct choice for multi-select', () => {
    expect(questionIssue({
      type: 'type_answer',
      time_limit_seconds: 20,
      points_base: 1000,
      answers: [{ text: '   ', is_correct: true }],
    }, 0)).toMatch(/accepted answer/);
    expect(questionIssue(mcq({
      type: 'multi_select',
      answers: [
        { text: 'A', is_correct: false },
        { text: 'B', is_correct: false },
      ],
    }), 0)).toMatch(/at least one correct/);
  });

  it('rejects a clock, a score, a media link, or a choice list the grader cannot use', () => {
    expect(questionIssue(mcq({ time_limit_seconds: null }), 0)).toMatch(/time limit/);
    expect(questionIssue(mcq({ points_base: 9000 }), 0)).toMatch(/points/);
    expect(questionIssue(mcq({ media_url: 'http://example.com/a.png' }), 0)).toMatch(/https/);
    expect(questionIssue(mcq({ answers: [{ text: 'Only', is_correct: true }] }), 0)).toMatch(/2 to 6/);
  });

  it('stops a quiz past 100 questions', () => {
    expect(() => assertPlayableQuestions(Array.from({ length: 101 }, () => mcq()))).toThrow(/100/);
  });
});
