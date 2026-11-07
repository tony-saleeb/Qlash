import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { pickProbeQuiz } = createRequire(import.meta.url)('./probeQuiz.cjs') as {
  pickProbeQuiz: (quizzes: { id: string; deleted_at?: string | null }[]) => {
    id: string | null;
    created: boolean;
  };
};

describe('pickProbeQuiz', () => {
  it('creates a quiz while the free library still has room', () => {
    expect(pickProbeQuiz([])).toEqual({ id: null, created: true });
    expect(
      pickProbeQuiz([
        { id: 'a', deleted_at: null },
        { id: 'b', deleted_at: null },
        { id: 'c', deleted_at: null },
        { id: 'd', deleted_at: null },
      ])
    ).toEqual({ id: null, created: true });
  });

  it('reuses a quiz once the free library is full', () => {
    const full = [
      { id: 'old', deleted_at: '2026-01-01' },
      { id: 'live', deleted_at: null },
      { id: 'c', deleted_at: null },
      { id: 'd', deleted_at: null },
      { id: 'e', deleted_at: null },
    ];
    expect(pickProbeQuiz(full)).toEqual({ id: 'live', created: false });
    expect(
      pickProbeQuiz(full.map((quiz) => ({ ...quiz, deleted_at: '2026-01-01' })))
    ).toEqual({ id: 'old', created: false });
  });
});
