import { describe, expect, it, vi } from 'vitest';
import { generateShareCode, importQuizPath, isShareCode, normalizeShareCode } from '@/lib/content/shareCode';

describe('share codes', () => {
  it('accepts a normalized 6 to 12 character code and encodes the import path', () => {
    expect(isShareCode(' abcd2345 ')).toBe(true);
    expect(normalizeShareCode('abcd2345')).toBe('ABCD2345');
    expect(importQuizPath('abcd2345')).toBe('/import/ABCD2345');
    expect(isShareCode('ABC12')).toBe(false);
    expect(isShareCode('!!!!')).toBe(false);
    expect(normalizeShareCode('A'.repeat(13))).toBe('A'.repeat(12));
    expect(isShareCode('A'.repeat(13))).toBe(true);
  });

  it('draws share codes from crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    const code = generateShareCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(generateShareCode(() => 0)).toBe('AAAAAAAA');
  });
});
