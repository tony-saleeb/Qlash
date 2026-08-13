import { describe, expect, it, vi } from 'vitest';
import { maybeShuffle, shuffle } from '@/lib/game/shuffle';

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
