const REFRESH_SKEW_MS = 120_000;
const AUTH_COOKIE = /(?:^sb-[\w-]+-auth-token(?:\.\d+)?$)/;

function decodeJwtExp(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function parseSessionBlob(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  if (trimmed.startsWith('base64-')) {
    try {
      candidates.push(atob(trimmed.slice('base64-'.length)));
    } catch {
      // ignore
    }
  }
  try {
    candidates.push(decodeURIComponent(trimmed));
  } catch {
    // ignore
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { expires_at?: number; access_token?: string };
      if (typeof parsed.expires_at === 'number') return parsed.expires_at;
      if (parsed.access_token) {
        const exp = decodeJwtExp(parsed.access_token);
        if (exp) return exp;
      }
    } catch {
      const exp = decodeJwtExp(candidate);
      if (exp) return exp;
    }
  }
  return null;
}

/** Read JWT expiry from the Supabase cookie without creating a client. */
export function cookieSessionExpiresAt(
  cookies: Array<{ name: string; value: string }>
): number | null {
  const chunks = cookies
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  if (chunks.length === 0) return null;
  return parseSessionBlob(chunks.map((cookie) => cookie.value).join(''));
}

/** True when the cookie JWT is missing or will expire within two minutes. */
export function sessionNeedsRefresh(
  expiresAt: number | null | undefined,
  nowMs = Date.now(),
  skewMs = REFRESH_SKEW_MS
): boolean {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return true;
  return expiresAt * 1000 <= nowMs + skewMs;
}

export function isHostAuthPrefetch(headers: {
  get(name: string): string | null;
}): boolean {
  return (
    headers.get('next-router-prefetch') === '1' ||
    headers.get('purpose') === 'prefetch'
  );
}
