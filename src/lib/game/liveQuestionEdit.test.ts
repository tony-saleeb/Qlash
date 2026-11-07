import { describe, expect, it } from 'vitest';
import {
  applyLiveQuestionEdit,
  patchQuestionBank,
  questionUpdatePayload,
} from '@/lib/game/liveQuestionEdit';
import type { Question } from '@/lib/game/types';

const stored: Question = {
  id: 'q1',
  type: 'mcq',
  prompt: 'Old prompt',
  media_url: null,
  media_type: null,
  time_limit_seconds: 20,
  points_base: 1000,
  scoring_type: 'linear',
  answers: [
    { id: 'b', text: 'Bee', color: '#e11d2e', shape: 'slash', is_correct: false },
    { id: 'a', text: 'Aye', color: '#4a2aff', shape: 'bolt', is_correct: true },
  ],
};

describe('applyLiveQuestionEdit', () => {
  it('writes new wording onto the stored answer order', () => {
    const edited = applyLiveQuestionEdit(stored, {
      prompt: 'New prompt',
      answers: [
        { id: 'a', text: 'Alpha' },
        { id: 'b', text: 'Beta' },
      ],
    });

    expect(edited.prompt).toBe('New prompt');
    expect(edited.answers.map((answer) => answer.id)).toEqual(['b', 'a']);
    expect(edited.answers.map((answer) => answer.text)).toEqual(['Beta', 'Alpha']);
    expect(edited.answers[1].is_correct).toBe(true);
    expect(edited.answers[0].color).toBe('#e11d2e');
    expect(stored.answers.map((answer) => answer.text)).toEqual(['Bee', 'Aye']);
  });
});

describe('questionUpdatePayload', () => {
  it('carries the prompt and answer text without the correct flag', () => {
    const payload = questionUpdatePayload(
      applyLiveQuestionEdit(stored, {
        prompt: 'New prompt',
        answers: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' },
        ],
      })
    );
    expect(payload).toEqual({
      question_id: 'q1',
      prompt: 'New prompt',
      answers: [
        { id: 'b', text: 'Beta' },
        { id: 'a', text: 'Alpha' },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('is_correct');
  });
});

describe('patchQuestionBank', () => {
  it('updates the clicker bank from a question:update and leaves other questions alone', () => {
    const other: Question = { ...stored, id: 'q2', prompt: 'Stay' };
    const bank = [stored, other];
    const payload = questionUpdatePayload(
      applyLiveQuestionEdit(stored, {
        prompt: 'New prompt',
        answers: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' },
        ],
      })
    );

    const next = patchQuestionBank(bank, payload);
    expect(next[0].prompt).toBe('New prompt');
    expect(next[0].answers.map((answer) => answer.id)).toEqual(['b', 'a']);
    expect(next[0].answers[1].is_correct).toBe(true);
    expect(next[1]).toBe(other);
  });

  it('ignores an update that only names the question', () => {
    const bank = [stored];
    expect(patchQuestionBank(bank, { question_id: 'q1' })).toBe(bank);
    expect(patchQuestionBank(bank, null)).toBe(bank);
  });
});
