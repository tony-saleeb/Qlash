import { describe, expect, it } from 'vitest';
import {
  isStaleHydrate,
  keepAnswerLayout,
  hostQuestionSession,
  mergeLiveSession,
  publicQuestionFromStartPayload,
  shouldAcceptQuestionClock,
} from '@/lib/game/liveQuestion';
import type { GameSessionRow, PublicQuestionPayload } from '@/lib/game/types';

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

  it('keeps the pause stamp even though it is earlier than the wall clock', () => {
    const incoming: GameSessionRow = {
      ...base,
      status: 'question_paused',
      question_started_at: '1970-01-01T00:00:03.000Z',
    };
    const merged = mergeLiveSession(base, incoming);
    expect(merged.status).toBe('question_paused');
    expect(merged.question_started_at).toBe('1970-01-01T00:00:03.000Z');
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

describe('hostQuestionSession', () => {
  it('paints a jump backward onto the projector', () => {
    const jumped = hostQuestionSession(base, 0, '2026-09-14T12:01:00.000Z');
    expect(jumped.current_question_index).toBe(0);
    expect(jumped.status).toBe('question_active');
    expect(jumped.question_started_at).toBe('2026-09-14T12:01:00.000Z');
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

  it('parses a type_answer start with no answer text', () => {
    const question = publicQuestionFromStartPayload({
      question_id: 'q3',
      type: 'type_answer',
      prompt: 'Capital?',
      time_limit_seconds: 20,
      answers: [],
    });
    expect(question?.answers).toEqual([]);
  });

  it('rejects an mcq start with no answers', () => {
    expect(
      publicQuestionFromStartPayload({
        question_id: 'q4',
        type: 'mcq',
        prompt: 'Capital?',
        time_limit_seconds: 20,
        answers: [],
      })
    ).toBeNull();
  });
});

describe('keepAnswerLayout', () => {
  const shown: PublicQuestionPayload = {
    id: 'q2',
    type: 'mcq',
    prompt: 'Capital of France?',
    media_url: null,
    media_type: null,
    time_limit_seconds: 20,
    answers: [
      { id: 'c', text: 'Nice', color: '#c8f542', shape: 'bolt' },
      { id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash' },
      { id: 'b', text: 'Lyon', color: '#4a2aff', shape: 'qring' },
    ],
  };

  it('keeps the on-screen order when the same question arrives in another order', () => {
    const incoming = { ...shown, answers: [shown.answers[1], shown.answers[2], shown.answers[0]] };
    expect(keepAnswerLayout(shown, incoming).answers.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('takes edited text without moving the button', () => {
    const incoming = {
      ...shown,
      prompt: 'Capital of France? (edited)',
      answers: [
        { id: 'a', text: 'Paris!', color: '#e11d2e', shape: 'slash' },
        { id: 'b', text: 'Lyon', color: '#4a2aff', shape: 'qring' },
        { id: 'c', text: 'Nice', color: '#c8f542', shape: 'bolt' },
      ],
    };
    const next = keepAnswerLayout(shown, incoming);
    expect(next.prompt).toBe('Capital of France? (edited)');
    expect(next.answers.map((a) => a.text)).toEqual(['Nice', 'Paris!', 'Lyon']);
  });

  it('uses the incoming payload for a different question or a different answer set', () => {
    const otherQuestion = { ...shown, id: 'q3' };
    expect(keepAnswerLayout(shown, otherQuestion)).toBe(otherQuestion);
    const changedSet = {
      ...shown,
      answers: [...shown.answers.slice(0, 2), { id: 'd', text: 'Lille', color: '#0a6b5c', shape: 'chevron' }],
    };
    expect(keepAnswerLayout(shown, changedSet)).toBe(changedSet);
    const shorter = { ...shown, answers: shown.answers.slice(0, 2) };
    expect(keepAnswerLayout(shown, shorter)).toBe(shorter);
    expect(keepAnswerLayout(null, shown)).toBe(shown);
  });
});

describe('isStaleHydrate', () => {
  it('drops a hydrate that belongs to an earlier question', () => {
    expect(isStaleHydrate({ liveIndex: 2, hydrateIndex: 1 })).toBe(true);
    expect(isStaleHydrate({ liveIndex: 2, hydrateIndex: 2 })).toBe(false);
    expect(isStaleHydrate({ liveIndex: null, hydrateIndex: 1 })).toBe(false);
  });
});
