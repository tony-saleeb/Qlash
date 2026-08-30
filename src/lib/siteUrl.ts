function isLocalHost(origin: string): boolean {
  return origin.includes('localhost') || origin.includes('127.0.0.1');
}

/** Canonical public origin for OAuth returns. Never use a Vercel deployment-id URL. */
export function publicSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (isLocalHost(origin)) return origin;
    if (fromEnv) return fromEnv;
    return origin;
  }

  return fromEnv;
}

export function authCallbackUrl(): string {
  const base = publicSiteUrl();
  return base ? `${base}/auth/callback` : '/auth/callback';
}

/** Absolute origin for Open Graph / sitemap. Falls back to localhost in dev. */
export function metadataBaseUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // ignore invalid env
    }
  }
  return new URL('http://localhost:3000');
}
