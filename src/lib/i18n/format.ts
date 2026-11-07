import type { Locale } from '@/lib/i18n/locale';

/** Dates and numbers follow the app language, not the browser language. */
export function formatHostDate(locale: Locale, iso: string, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(
    locale,
    withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }
  ).format(date);
}

export function formatHostNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}
