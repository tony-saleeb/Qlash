import { describe, expect, it } from 'vitest';
import { NICKNAME_MAX_LEN } from '@/lib/game/constants';
import { cleanPlayerName } from '@/lib/game/playerName';

describe('cleanPlayerName', () => {
  it('strips invisible and bidi characters before the length cap', () => {
    expect(cleanPlayerName(`Ada${'\u200B'.repeat(10)}`, NICKNAME_MAX_LEN)).toBe('Ada');
    expect(cleanPlayerName(`\u202EAda`, NICKNAME_MAX_LEN)).toBe('Ada');
    expect(cleanPlayerName(`A${'\u200B'}da`, NICKNAME_MAX_LEN)).toBe('Ada');
    expect(cleanPlayerName('\u200B\uFEFF', NICKNAME_MAX_LEN)).toBe('');
  });

  it('rejects a non-string and keeps Arabic letters', () => {
    expect(cleanPlayerName(12, NICKNAME_MAX_LEN)).toBeNull();
    expect(cleanPlayerName(['Ada'], NICKNAME_MAX_LEN)).toBeNull();
    expect(cleanPlayerName('  نور  ', NICKNAME_MAX_LEN)).toBe('نور');
  });
});
