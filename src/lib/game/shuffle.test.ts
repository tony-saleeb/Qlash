import { describe, expect, it, vi } from 'vitest';
import { maybeSeededShuffle, maybeShuffle, questionsInPlayOrder, seededShuffle, shuffle } from '@/lib/game/shuffle';

describe('shuffle', () => {
  it('preserves elements and returns a new array', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect([...out].sort()).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['only'])).toEqual(['only']);
  });

  it('can reorder when Math.random is stubbed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(shuffle(['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
  });
});

describe('maybeShuffle', () => {
  it('copies without shuffling when disabled', () => {
    const input = ['a', 'b', 'c'];
    const out = maybeShuffle(input, false);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('shuffles when enabled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(maybeShuffle(['a', 'b', 'c'], true)).toEqual(['b', 'c', 'a']);
  });
});

describe('seededShuffle', () => {
  it('is stable for the same seed and independent of Math.random', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const first = seededShuffle(input, 'sess-1:q1');
    const second = seededShuffle(input, 'sess-1:q1');
    expect(first).toEqual(second);
    expect([...first].sort()).toEqual([...input].sort());
    expect(maybeSeededShuffle(input, false, 'sess-1:q1')).toEqual(input);
  });
});

describe('questionsInPlayOrder', () => {
  it('follows persisted ids and appends leftovers', () => {
    const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(questionsInPlayOrder(questions, ['c', 'a']).map((q) => q.id)).toEqual(['c', 'a', 'b']);
    expect(questionsInPlayOrder(questions, null)).toEqual(questions);
  });
});
