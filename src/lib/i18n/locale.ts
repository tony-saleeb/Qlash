export const LOCALE_STORAGE_KEY = 'qlash_locale';
export const LOCALE_COOKIE_KEY = 'qlash_locale';
export const LOCALE_HEADER = 'x-qlash-locale';

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

/** First tag that is clearly Arabic or English. Default English. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return 'en';
  const tags = header.split(',');
  for (const part of tags) {
    const tag = part.split(';')[0]?.trim().toLowerCase() ?? '';
    if (tag.startsWith('ar')) return 'ar';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
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

export function readCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_KEY}=([^;]*)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : '';
  return isLocale(raw) ? raw : null;
}

export function writeCookieLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function writeStoredLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  writeCookieLocale(locale);
}

export function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

export function resolveClientLocale(initial?: Locale): Locale {
  return (
    readStoredLocale() ??
    readCookieLocale() ??
    (initial ? normalizeLocale(initial) : detectBrowserLocale())
  );
}

/** Runs before paint so html lang/dir match the visitor without a flash. */
export function localeBootScript(): string {
  return `(function(){try{var s=null;try{s=localStorage.getItem('${LOCALE_STORAGE_KEY}');}catch(e){}var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE_KEY}=([^;]*)/);var c=m?decodeURIComponent(m[1]):'';var n=(navigator.language||'').toLowerCase();var loc=(s==='ar'||s==='en')?s:(c==='ar'||c==='en')?c:(n.indexOf('ar')===0?'ar':'en');document.documentElement.lang=loc==='ar'?'ar':'en';document.documentElement.dir=loc==='ar'?'rtl':'ltr';}catch(e){}})();`;
}
