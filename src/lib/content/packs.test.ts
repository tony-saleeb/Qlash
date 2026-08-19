import { describe, expect, it } from 'vitest';
import { CONTENT_PACKS, getContentPack, isContentPackId } from '@/lib/content/packs';
import { packToQuestionRows } from '@/lib/content/packRows';
import { generateShareCode, normalizeShareCode } from '@/lib/content/shareCode';

describe('content packs', () => {
  it('keeps three classroom packs with at least one correct answer each', () => {
    expect(CONTENT_PACKS.map((pack) => pack.id)).toEqual(['sunday-school', 'general-ar', 'warmup']);
    for (const pack of CONTENT_PACKS) {
      expect(pack.questions.length).toBeGreaterThan(0);
      expect(pack.questions.every((question) => question.answers.some((answer) => answer.correct))).toBe(true);
    }
    expect(getContentPack('warmup')?.questions).toHaveLength(8);
    expect(isContentPackId('nope')).toBe(false);
  });

  it('maps pack answers onto Qlash marks', () => {
    const rows = packToQuestionRows('quiz-1', getContentPack('warmup')!);
    expect(rows[0]).toMatchObject({ quiz_id: 'quiz-1', type: 'mcq', scoring_type: 'linear' });
    expect(rows[0].answers.some((answer) => answer.is_correct)).toBe(true);
  });
});

describe('share codes', () => {
  it('normalizes and generates 8-character codes', () => {
    expect(normalizeShareCode(' ab-cd12 ')).toBe('ABCD12');
    expect(generateShareCode(() => 0)).toHaveLength(8);
  });
});
