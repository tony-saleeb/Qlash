import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE_KEY, LOCALE_HEADER, normalizeLocale, type Locale } from '@/lib/i18n/locale';

export function readRequestLocale(): Locale {
  return normalizeLocale(headers().get(LOCALE_HEADER) ?? cookies().get(LOCALE_COOKIE_KEY)?.value);
}
