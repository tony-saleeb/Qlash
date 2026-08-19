import { describe, expect, it } from 'vitest';
import { isLocale, normalizeLocale } from '@/lib/i18n/locale';
import { MESSAGES, t } from '@/lib/i18n/messages';

describe('i18n', () => {
  it('keeps English and Arabic dictionaries in lockstep', () => {
    expect(Object.keys(MESSAGES.ar).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });

  it('translates classroom chrome', () => {
    expect(t('en', 'startGame')).toBe('Start game');
    expect(t('ar', 'startGame')).toBe('يلا نبدأ');
    expect(t('ar', 'enterPin')).toBe('اكتب');
    expect(t('ar', 'joinAGame')).toBe('ادخل لعبة');
    expect(t('ar', 'heroBody')).toContain('اكتب الكود وادخل');
    expect(t('ar', 'gamePin')).toBe('كود الدخول');
    expect(t('en', 'lateJoin')).toBe('Late join');
    expect(t('ar', 'lateJoin')).toBe('اللي يتأخر يدخل');
    expect(t('ar', 'copyLobbyLink')).toBe('انسخ لينك الغرفة');
    expect(t('ar', 'lobbyTipBoard')).toBe('اسمك ظاهر على الشاشة خلاص.');
    expect(isLocale('ar')).toBe(true);
    expect(normalizeLocale('nope')).toBe('en');
  });
});
