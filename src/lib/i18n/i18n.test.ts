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
    expect(t('en', 'shareWhatsApp')).toBe('WhatsApp');
    expect(t('ar', 'shareWhatsApp')).toBe('واتساب');
    expect(t('ar', 'lobbyTipBoard')).toBe('اسمك ظاهر على الشاشة خلاص.');
    expect(t('ar', 'leaveLobby')).toBe('خروج');
    expect(t('en', 'quitRoom')).toBe('Quit');
    expect(t('ar', 'quitRoom')).toBe('قفل الغرفة');
    expect(t('ar', 'tapToCheer')).toContain('اضغط علامة');
    expect(t('en', 'lightning')).toBe('Lightning!');
    expect(t('ar', 'lightning')).toBe('برق!');
    expect(t('ar', 'firstLock')).toBe('أول قفل');
    expect(t('ar', 'answerLocked')).toBe('الإجابة اتقفلت');
    expect(t('ar', 'youAreOffline')).toContain('أوفلاين');
    expect(t('en', 'playAgain')).toBe('Play again');
    expect(t('ar', 'showFinalPodium')).toBe('ورّي المنصة النهائية');
    expect(t('en', 'resultsCalculated')).toBe('Results calculated!');
    expect(t('ar', 'validGamePin')).toContain('6');
    expect(t('ar', 'typeYourAnswer')).toBe('اكتب إجابتك');
    expect(t('en', 'secondPlace')).toBe('2nd');
    expect(isLocale('ar')).toBe(true);
    expect(normalizeLocale('nope')).toBe('en');
  });
});
