import { describe, expect, it } from 'vitest';
import { ogSafeText } from '@/lib/ogText';

describe('ogSafeText', () => {
  it('keeps Latin titles', () => {
    expect(ogSafeText('Sunday School Week 3', 'Quiz')).toBe('Sunday School Week 3');
  });

  it('falls back when the title is Arabic so Satori does not crash', () => {
    expect(ogSafeText('مدارس الأحد', 'Shared quiz')).toBe('Shared quiz');
  });

  it('falls back on empty text', () => {
    expect(ogSafeText('   ', 'Qlash')).toBe('Qlash');
  });
});
