import type { Locale } from '@/lib/i18n/locale';

export function lobbyJoinPath(pin: string): string {
  const clean = pin.replace(/\D/g, '').slice(0, 6);
  return `/play?pin=${clean}`;
}

export function lobbyJoinUrl(origin: string, pin: string): string {
  return `${origin.replace(/\/$/, '')}${lobbyJoinPath(pin)}`;
}

export function pinFromSearch(search: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const pin = (new URLSearchParams(raw).get('pin') || '').replace(/\D/g, '').slice(0, 6);
  return pin.length === 6 ? pin : null;
}

export function lobbyShareText(locale: Locale, pin: string, url: string): string {
  const clean = pin.replace(/\D/g, '').slice(0, 6);
  if (locale === 'ar') {
    return `ادخلوا غرفة قلاش.\nالكود: ${clean}\n${url}`;
  }
  return `Join our Qlash room.\nPIN: ${clean}\n${url}`;
}

export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function lobbyWhatsAppHref(origin: string, pin: string, locale: Locale): string {
  return whatsAppShareUrl(lobbyShareText(locale, pin, lobbyJoinUrl(origin, pin)));
}
