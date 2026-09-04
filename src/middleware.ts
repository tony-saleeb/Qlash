import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  isLocale,
  localeFromAcceptLanguage,
  LOCALE_COOKIE_KEY,
  LOCALE_HEADER,
  type Locale,
} from '@/lib/i18n/locale';
import {
  cookieSessionExpiresAt,
  isHostAuthPrefetch,
  sessionNeedsRefresh,
} from '@/lib/supabase/hostSession';

function resolveRequestLocale(request: NextRequest): Locale {
  const existing = request.cookies.get(LOCALE_COOKIE_KEY)?.value;
  if (isLocale(existing)) return existing;
  return localeFromAcceptLanguage(request.headers.get('accept-language'));
}

function applyLocale(request: NextRequest, response: NextResponse, locale: Locale) {
  response.headers.set(LOCALE_HEADER, locale);
  if (!isLocale(request.cookies.get(LOCALE_COOKIE_KEY)?.value)) {
    response.cookies.set(LOCALE_COOKIE_KEY, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }
  return response;
}

function nextWithLocale(request: NextRequest, locale: Locale) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  return applyLocale(
    request,
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    locale
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = resolveRequestLocale(request);

  // Skip auth refresh for public/player traffic — hosts refresh on dashboard/host/editor
  if (
    pathname === '/' ||
    pathname === '/register' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/play') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/q/') ||
    pathname.startsWith('/p/')
  ) {
    return nextWithLocale(request, locale);
  }

  if (isHostAuthPrefetch(request.headers)) {
    return nextWithLocale(request, locale);
  }

  const cookieExp = cookieSessionExpiresAt(request.cookies.getAll());
  if (!sessionNeedsRefresh(cookieExp)) {
    return nextWithLocale(request, locale);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return applyLocale(request, response, locale);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
