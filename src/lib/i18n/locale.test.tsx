/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyDocumentLocale,
  detectBrowserLocale,
  isLocale,
  localeBootScript,
  localeFromAcceptLanguage,
  normalizeLocale,
  readCookieLocale,
  readStoredLocale,
  resolveClientLocale,
  writeStoredLocale,
} from '@/lib/i18n/locale';

describe('locale helpers', () => {
  afterEach(() => {
    localStorage.clear();
    document.cookie = 'qlash_locale=; path=/; max-age=0';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('treats only en and ar as locales', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(normalizeLocale('nope')).toBe('en');
  });

  it('reads Arabic from Accept-Language before English', () => {
    expect(localeFromAcceptLanguage('ar-EG,ar;q=0.9,en;q=0.8')).toBe('ar');
    expect(localeFromAcceptLanguage('en-US,en;q=0.9')).toBe('en');
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9')).toBe('en');
    expect(localeFromAcceptLanguage(null)).toBe('en');
  });

  it('detects Arabic from navigator.language', () => {
    const original = navigator.language;
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ar-EG' });
    expect(detectBrowserLocale()).toBe('ar');
    Object.defineProperty(navigator, 'language', { configurable: true, value: original });
  });

  it('persists locale to storage and cookie', () => {
    writeStoredLocale('ar');
    expect(readStoredLocale()).toBe('ar');
    expect(readCookieLocale()).toBe('ar');
  });

  it('prefers stored locale over an initial server value', () => {
    writeStoredLocale('ar');
    expect(resolveClientLocale('en')).toBe('ar');
  });

  it('applies lang and dir on the document', () => {
    applyDocumentLocale('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('emits a boot script that reads storage then cookie then the browser', () => {
    const script = localeBootScript();
    expect(script).toContain('qlash_locale');
    expect(script).toContain('localStorage');
    expect(script).toContain("n.indexOf('ar')===0");
    expect(script).toContain('document.documentElement.dir');
  });
});
