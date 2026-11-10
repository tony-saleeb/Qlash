import { describe, expect, it } from 'vitest';
import { decodeQuizFileText } from '@/lib/content/decodeQuizFile';

describe('decodeQuizFileText', () => {
  it('reads an Excel Arabic ANSI file as windows-1256', () => {
    const bytes = Uint8Array.from([0xc7, 0xe1, 0xde, 0xc7, 0xe5, 0xd1, 0xc9]);
    expect(decodeQuizFileText(bytes)).toBe('القاهرة');
  });

  it('keeps a real UTF-8 file', () => {
    const bytes = new TextEncoder().encode('القاهرة');
    expect(decodeQuizFileText(bytes)).toBe('القاهرة');
  });
});