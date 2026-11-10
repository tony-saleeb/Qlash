import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publicSiteUrl } from '@/lib/siteUrl';
import { safeNextPath } from '@/lib/auth/safeNextPath';
import { isLocale, localeFromAcceptLanguage, LOCALE_COOKIE_KEY, type Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/messages';

const OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
type EmailOtpType = (typeof OTP_TYPES)[number];

function isEmailOtpType(value: string): value is EmailOtpType {
  return (OTP_TYPES as readonly string[]).includes(value);
}

function redirectBase(origin: string): string {
  return publicSiteUrl() || origin;
}

function requestLocale(request: Request): Locale {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_KEY}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : '';
  if (isLocale(value)) return value;
  return localeFromAcceptLanguage(request.headers.get('accept-language'));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** A clicked email link is a GET. Signing in has to be a same-origin POST. */
function confirmPostAllowed(request: Request): boolean {
  const site = (request.headers.get('sec-fetch-site') ?? '').toLowerCase();
  if (site === 'cross-site') return false;
  const origin = request.headers.get('origin');
  let requestOrigin = '';
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }
  const allowed = new Set([requestOrigin]);
  const canonical = publicSiteUrl();
  if (canonical) {
    try {
      allowed.add(new URL(canonical).origin);
    } catch {
      /* ignore a bad site url */
    }
  }
  if (origin) return allowed.has(origin);
  return site === 'same-origin' || site === 'none';
}

function confirmPage(request: Request, tokenHash: string, type: string, next: string): NextResponse {
  const locale = requestLocale(request);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(t(locale, 'confirmSignInTitle'))}</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0e14;color:#fff;font-family:sans-serif">
  <main style="width:min(28rem,calc(100% - 2rem));padding:2rem;background:#171a22">
    <p style="margin:0;font-size:0.75rem;letter-spacing:0.16em;text-transform:uppercase;color:#c8f542">Qlash</p>
    <h1 style="margin:0.75rem 0 0;font-size:1.75rem">${escapeHtml(t(locale, 'confirmSignInTitle'))}</h1>
    <p style="line-height:1.5;color:rgba(255,255,255,0.72)">${escapeHtml(t(locale, 'confirmSignInBody'))}</p>
    <form method="post" action="/auth/confirm">
      <input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}" />
      <input type="hidden" name="type" value="${escapeHtml(type)}" />
      <input type="hidden" name="next" value="${escapeHtml(next)}" />
      <button type="submit" style="height:3rem;width:100%;border:0;background:#e11d2e;color:#fff;font-weight:800;cursor:pointer">${escapeHtml(t(locale, 'confirmSignIn'))}</button>
    </form>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const base = redirectBase(origin);

  if (!tokenHash || !type || !isEmailOtpType(type)) {
    return NextResponse.redirect(`${base}/?authError=1`);
  }

  return confirmPage(request, tokenHash, type, safeNextPath(searchParams.get('next')));
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const base = redirectBase(origin);
  if (!confirmPostAllowed(request)) {
    return NextResponse.json({ error: 'This request was refused.' }, { status: 403 });
  }

  const form = await request.formData();
  const tokenHash = form.get('token_hash');
  const type = form.get('type');
  const next = safeNextPath(typeof form.get('next') === 'string' ? String(form.get('next')) : null);

  if (typeof tokenHash !== 'string' || !tokenHash || typeof type !== 'string' || !isEmailOtpType(type)) {
    return NextResponse.redirect(`${base}/?authError=1`, 303);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${base}/?authError=1`, 303);
  }
  return NextResponse.redirect(`${base}${next}`, 303);
}
