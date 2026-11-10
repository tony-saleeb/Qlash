import { describe, expect, it } from 'vitest';
import { normalizeAnswerText } from '@/lib/game/answerText';

describe('normalizeAnswerText', () => {
  it('treats alef, taa marbuta, alef maksura, and short vowels as the same letter', () => {
    expect(normalizeAnswerText('الْقَاهِرَة')).toBe(normalizeAnswerText('القاهره'));
    expect(normalizeAnswerText('إلى')).toBe(normalizeAnswerText('الي'));
    expect(normalizeAnswerText('  NAYROUZ ')).toBe('nayrouz');
  });
});
