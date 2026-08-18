import { describe, expect, it } from 'vitest';
import { containsRtl, textDir } from '@/lib/rtl';

describe('textDir', () => {
  it('marks Arabic and Hebrew as rtl', () => {
    expect(textDir('ماهى المعجزة التى تدخلت فيها العذراء لإتمامها ؟')).toBe('rtl');
    expect(textDir('שלום')).toBe('rtl');
    expect(containsRtl('عرس قانا الجليل')).toBe(true);
  });

  it('keeps English and empty strings ltr', () => {
    expect(textDir('Capital of France?')).toBe('ltr');
    expect(textDir('')).toBe('ltr');
    expect(textDir(null)).toBe('ltr');
  });
});
