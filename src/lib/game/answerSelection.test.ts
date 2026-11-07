import { describe, expect, it } from 'vitest';
import { cleanAnswerSelection, selectionMatchesQuestion } from '@/lib/game/answerSelection';

describe('cleanAnswerSelection', () => {
  it('rejects a repeated poll vote, a fake extra id, and a long typed answer', () => {
    expect(cleanAnswerSelection(['1', '1', '1', '1', '1', '1'])).toBeNull();
    expect(cleanAnswerSelection(['real', 2])).toBeNull();
    expect(cleanAnswerSelection(['a'.repeat(81)])).toBeNull();
    expect(cleanAnswerSelection(['  cairo  '])).toEqual(['cairo']);
  });

  it('keeps a distinct multi-select set', () => {
    expect(cleanAnswerSelection(['1', '2'])).toEqual(['1', '2']);
  });
});

describe('selectionMatchesQuestion', () => {
  const ids = ['1', '2', '3'];

  it('counts one real choice for a poll and ignores an id the question does not have', () => {
    expect(selectionMatchesQuestion('poll', ids, ['1'])).toBe(true);
    expect(selectionMatchesQuestion('poll', ids, ['1', '1'])).toBe(false);
    expect(selectionMatchesQuestion('mcq', ids, ['9'])).toBe(false);
    expect(selectionMatchesQuestion('mcq', ids, ['1', '2'])).toBe(false);
  });

  it('allows several real multi-select ids and one typed answer of any text', () => {
    expect(selectionMatchesQuestion('multi_select', ids, ['3', '1'])).toBe(true);
    expect(selectionMatchesQuestion('multi_select', ids, ['1', 'nope'])).toBe(false);
    expect(selectionMatchesQuestion('type_answer', ids, ['القاهرة'])).toBe(true);
    expect(selectionMatchesQuestion('type_answer', ids, ['cairo', 'giza'])).toBe(false);
  });
});
