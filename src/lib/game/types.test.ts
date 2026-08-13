import { describe, expect, it } from 'vitest';
import {
  buildQuestionStartPayload,
  sanitizeAnswers,
  toPublicQuestion,
  type Question,
} from '@/lib/game/types';

const question: Question = {
  id: 'q1',
  type: 'mcq',
  prompt: 'Capital of France?',
  media_url: 'https://cdn.example/eiffel.png',
  media_type: 'image',
  time_limit_seconds: 20,
  points_base: 1000,
  scoring_type: 'linear',
  answers: [
    { id: 'a', text: 'Paris', color: '#1368ce', shape: 'diamond', is_correct: true },
    { id: 'b', text: 'Lyon', color: '#e21b3c', shape: 'triangle', is_correct: false },
  ],
};

describe('sanitizeAnswers', () => {
  it('strips correctness and remaps Kahoot identity onto Qlash marks', () => {
    const publicAnswers = sanitizeAnswers(question.answers);
    expect(publicAnswers).toEqual([
      { id: 'a', text: 'Paris', color: '#4a2aff', shape: 'qring' },
      { id: 'b', text: 'Lyon', color: '#e11d2e', shape: 'slash' },
    ]);
    expect(publicAnswers[0]).not.toHaveProperty('is_correct');
  });
});

describe('toPublicQuestion', () => {
  it('drops scoring fields that players must not see', () => {
    const payload = toPublicQuestion(question);
    expect(payload).toEqual({
      id: 'q1',
      type: 'mcq',
      prompt: 'Capital of France?',
      media_url: 'https://cdn.example/eiffel.png',
      media_type: 'image',
      time_limit_seconds: 20,
      answers: [
        { id: 'a', text: 'Paris', color: '#4a2aff', shape: 'qring' },
        { id: 'b', text: 'Lyon', color: '#e11d2e', shape: 'slash' },
      ],
    });
    expect(payload).not.toHaveProperty('points_base');
    expect(payload).not.toHaveProperty('scoring_type');
  });
});

describe('buildQuestionStartPayload', () => {
  it('includes server clock and sanitized answers for broadcast', () => {
    const payload = buildQuestionStartPayload(question, 2, '2026-08-13T20:00:00.000Z');
    expect(payload.question_id).toBe('q1');
    expect(payload.question_index).toBe(2);
    expect(payload.server_started_at).toBe('2026-08-13T20:00:00.000Z');
    expect(payload.answers[0]).not.toHaveProperty('is_correct');
  });
});
