import { describe, expect, it } from 'vitest';
import { keepStoredQuestion, questionsForReport } from '@/lib/game/questionArchive';

const live = { id: 'live', archived_at: null };
const removed = { id: 'removed', archived_at: '2026-11-07T00:00:00.000Z' };

describe('question archive', () => {
  it('hides a removed question from a new game', () => {
    expect(keepStoredQuestion(removed, [])).toBe(false);
    expect(keepStoredQuestion(live, [])).toBe(true);
  });

  it('keeps a removed question that this room already started', () => {
    expect(keepStoredQuestion(removed, ['removed'])).toBe(true);
  });

  it('keeps a removed question on the report when the class answered it', () => {
    const kept = questionsForReport([live, removed], [{ question_id: 'removed' }], []);
    expect(kept.map((question) => question.id)).toEqual(['live', 'removed']);
  });

  it('drops a removed question the class was never asked', () => {
    const kept = questionsForReport([live, removed], [], ['live']);
    expect(kept.map((question) => question.id)).toEqual(['live']);
  });
});
