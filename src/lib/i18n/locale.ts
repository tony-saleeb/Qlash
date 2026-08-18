export const LOCALE_STORAGE_KEY = 'qlash_locale';

export type Locale = 'en' | 'ar';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ar';
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || '').toLowerCase();
  return lang.startsWith('ar') ? 'ar' : 'en';
}

export function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}
