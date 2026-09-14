import { describe, expect, it } from 'vitest';
import {
  isStaleHydrate,
  mergeLiveSession,
  publicQuestionFromStartPayload,
  shouldAcceptQuestionClock,
} from '@/lib/game/liveQuestion';
import type { GameSessionRow } from '@/lib/game/types';

const base: GameSessionRow = {
  id: 'sess-1',
  pin: '550000',
  status: 'question_active',
  current_question_index: 1,
  question_started_at: '2026-09-14T12:00:20.000Z',
  quiz_id: 'quiz-1',
};

describe('mergeLiveSession', () => {
  it('keeps a newer clock when an older stamp for the same index arrives late', () => {
    const incoming: GameSessionRow = {
      ...base,
      question_started_at: '2026-09-14T12:00:00.000Z',
    };
    expect(mergeLiveSession(base, incoming).question_started_at).toBe('2026-09-14T12:00:20.000Z');
  });

  it('ignores a session update that rewinds the question index', () => {
    const incoming: GameSessionRow = { ...base, current_question_index: 0 };
    expect(mergeLiveSession(base, incoming)).toBe(base);
  });

  it('accepts a later question', () => {
    const incoming: GameSessionRow = {
      ...base,
      current_question_index: 2,
      question_started_at: '2026-09-14T12:00:40.000Z',
    };
    expect(mergeLiveSession(base, incoming)).toEqual(incoming);
  });
});

describe('shouldAcceptQuestionClock', () => {
  it('rejects an earlier stamp', () => {
    expect(
      shouldAcceptQuestionClock('2026-09-14T12:00:20.000Z', '2026-09-14T12:00:00.000Z')
    ).toBe(false);
  });

  it('accepts the first stamp and later ones', () => {
    expect(shouldAcceptQuestionClock(null, '2026-09-14T12:00:20.000Z')).toBe(true);
    expect(
      shouldAcceptQuestionClock('2026-09-14T12:00:20.000Z', '2026-09-14T12:00:20.000Z')
    ).toBe(true);
  });
});

describe('publicQuestionFromStartPayload', () => {
  it('reads the broadcast question without correctness flags', () => {
    const question = publicQuestionFromStartPayload({
      question_id: 'q2',
      question_index: 1,
      type: 'mcq',
      prompt: 'Next up?',
      media_url: null,
      media_type: null,
      time_limit_seconds: 20,
      answers: [{ id: 'a', text: 'Yes', color: '#e11d2e', shape: 'slash' }],
      server_started_at: '2026-09-14T12:00:20.000Z',
    });
    expect(question).toMatchObject({ id: 'q2', prompt: 'Next up?' });
    expect(question?.answers[0]).not.toHaveProperty('is_correct');
  });

  it('rejects a malformed payload', () => {
    expect(publicQuestionFromStartPayload({ prompt: 'nope' })).toBeNull();
  });
});

describe('isStaleHydrate', () => {
  it('drops a hydrate that belongs to an earlier question', () => {
    expect(isStaleHydrate({ liveIndex: 2, hydrateIndex: 1 })).toBe(true);
    expect(isStaleHydrate({ liveIndex: 2, hydrateIndex: 2 })).toBe(false);
    expect(isStaleHydrate({ liveIndex: null, hydrateIndex: 1 })).toBe(false);
  });
});
