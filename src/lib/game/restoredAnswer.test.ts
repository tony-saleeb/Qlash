import { describe, expect, it } from 'vitest';
import { choiceIdsForReveal, restoredAnswerIds, shouldLockRestoredAnswer } from '@/lib/game/restoredAnswer';

describe('restored answers', () => {
  it('keeps only string ids', () => {
    expect(restoredAnswerIds(['b', 1, '', 'a'])).toEqual(['b', 'a']);
    expect(restoredAnswerIds(null)).toEqual([]);
  });

  it('locks the phone only while the question is still open', () => {
    expect(shouldLockRestoredAnswer('question_active', ['b'])).toBe(true);
    expect(shouldLockRestoredAnswer('question_paused', ['b'])).toBe(true);
    expect(shouldLockRestoredAnswer('question_reveal', ['b'])).toBe(false);
    expect(shouldLockRestoredAnswer('question_active', [])).toBe(false);
  });

  it('prefers the stored choice over whatever the phone remembers', () => {
    expect(choiceIdsForReveal(['c'], ['b'])).toEqual(['b']);
    expect(choiceIdsForReveal(['c'], [])).toEqual(['c']);
  });
});
