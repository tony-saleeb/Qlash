import { describe, expect, it } from 'vitest';
import { buildTeachableReveal, formatTeachableCopy } from '@/lib/game/teachableReveal';

const answers = [
  { id: 'a', text: 'Cairo', is_correct: true },
  { id: 'b', text: 'Alexandria', is_correct: false },
  { id: 'c', text: 'Giza', is_correct: false },
];

describe('buildTeachableReveal', () => {
  it('calls out the crowd when they miss', () => {
    const result = buildTeachableReveal(answers, { a: 2, b: 10, c: 1 });
    expect(result.headline).toBe('Most of you picked Alexandria.');
    expect(result.subline).toBe('Correct: Cairo');
    expect(result.mostPicked?.percent).toBe(77);
    expect(result.mostPickedIsCorrect).toBe(false);
  });

  it('celebrates when most picked the correct option', () => {
    const result = buildTeachableReveal(answers, { a: 8, b: 1, c: 1 });
    expect(result.headline).toBe('The room got this.');
    expect(result.subline).toBe('Cairo');
    expect(result.mostPickedIsCorrect).toBe(true);
  });

  it('treats polls as a vote, not a miss', () => {
    const result = buildTeachableReveal(
      [
        { id: 'a', text: 'Red', is_correct: false },
        { id: 'b', text: 'Blue', is_correct: false },
      ],
      { a: 3, b: 9 },
      'poll'
    );
    expect(result.kind).toBe('poll');
    expect(result.headline).toBe('The room picked Blue.');
    expect(result.subline).toBe('75% of answers');
  });

  it('handles empty rooms and ties', () => {
    expect(buildTeachableReveal(answers, {}).headline).toBe('No answers this round.');
    expect(buildTeachableReveal(answers, { a: 4, b: 4 }).headline).toBe('The room split.');
  });
});

describe('formatTeachableCopy', () => {
  it('renders Arabic classroom copy from the same reveal', () => {
    const lesson = buildTeachableReveal(answers, { a: 2, b: 10, c: 1 });
    const copy = formatTeachableCopy(lesson, 'ar');
    expect(copy.headline).toBe('أغلبكم اختار Alexandria.');
    expect(copy.subline).toBe('الصحيح: Cairo');
  });
});
