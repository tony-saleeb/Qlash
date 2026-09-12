import { describe, expect, it } from 'vitest';
import {
  activeQuestionForIndex,
  isLastSessionIndex,
  sessionIndexForQuestion,
  sessionQuestionCount,
} from '@/lib/game/playOrder';

const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const order = ['a', 'b', 'c', 'd'];

describe('activeQuestionForIndex', () => {
  it('resolves by id from the sealed order', () => {
    expect(activeQuestionForIndex(questions, order, 0)?.id).toBe('a');
    expect(activeQuestionForIndex(questions, order, 3)?.id).toBe('d');
  });

  it('follows a shuffled order rather than array position', () => {
    expect(activeQuestionForIndex(questions, ['c', 'a', 'd', 'b'], 0)?.id).toBe('c');
    expect(activeQuestionForIndex(questions, ['c', 'a', 'd', 'b'], 1)?.id).toBe('a');
  });

  it('keeps later questions aligned when one was deleted mid-session', () => {
    // The quiz lost 'b', so the host only holds a, c, d — but the phones still
    // resolve order[2] === 'c'. Position-based lookup would have shown 'd'.
    const remaining = [{ id: 'a' }, { id: 'c' }, { id: 'd' }];
    expect(activeQuestionForIndex(remaining, order, 2)?.id).toBe('c');
    expect(activeQuestionForIndex(remaining, order, 3)?.id).toBe('d');
  });

  it('returns null for a deleted question instead of a different one', () => {
    const remaining = [{ id: 'a' }, { id: 'c' }, { id: 'd' }];
    expect(activeQuestionForIndex(remaining, order, 1)).toBeNull();
  });

  it('returns null past the end of the order', () => {
    expect(activeQuestionForIndex(questions, order, 4)).toBeNull();
    expect(activeQuestionForIndex(questions, order, -1)).toBeNull();
  });

  it('falls back to array position when no order is sealed yet', () => {
    expect(activeQuestionForIndex(questions, null, 1)?.id).toBe('b');
    expect(activeQuestionForIndex(questions, [], 1)?.id).toBe('b');
    expect(activeQuestionForIndex(questions, null, 9)).toBeNull();
  });
});

describe('sessionIndexForQuestion', () => {
  it('maps a question to its position in the sealed order', () => {
    expect(sessionIndexForQuestion(['c', 'a', 'd', 'b'], 'd', 0)).toBe(2);
    expect(sessionIndexForQuestion(order, 'a', 3)).toBe(0);
  });

  it('falls back when the order is missing or the question is not in it', () => {
    expect(sessionIndexForQuestion(null, 'a', 2)).toBe(2);
    expect(sessionIndexForQuestion(order, 'zz', 2)).toBe(2);
  });
});

describe('session length', () => {
  it('counts the sealed order, not the edited quiz', () => {
    expect(sessionQuestionCount(order, 3)).toBe(4);
    expect(sessionQuestionCount(null, 3)).toBe(3);
    expect(isLastSessionIndex(order, 3, 3)).toBe(true);
    expect(isLastSessionIndex(order, 3, 2)).toBe(false);
    expect(isLastSessionIndex(null, 3, 2)).toBe(true);
  });
});
