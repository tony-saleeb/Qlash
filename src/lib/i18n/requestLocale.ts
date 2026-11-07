import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE_KEY, LOCALE_HEADER, normalizeLocale, type Locale } from '@/lib/i18n/locale';

export async function readRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return normalizeLocale(headerStore.get(LOCALE_HEADER) ?? cookieStore.get(LOCALE_COOKIE_KEY)?.value);
}
