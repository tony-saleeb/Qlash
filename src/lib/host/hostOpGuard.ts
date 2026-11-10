import { publicSiteUrl } from '@/lib/siteUrl';

const DATABASE_LEAK =
  /duplicate key|violates |row-level security|permission denied|PGRST|syntax error|SQLSTATE|\brelation\b|\bcolumn\b|hint:|detail:/i;

/** A browser fetch from this app. A cross-site form cannot set these headers to match. */
export function hostOpRequestAllowed(request: Request): boolean {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType.trim())) return false;

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
      // ignore a bad site url
    }
  }
  if (origin) return allowed.has(origin);
  return site === 'same-origin' || site === 'none';
}

/** App errors stay readable. Postgres and RLS text does not. */
export function hostOpClientError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message.trim() : '';
  if (/^unauthorized\b/i.test(raw) && !DATABASE_LEAK.test(raw)) {
    return { status: 401, message: 'Unauthorized. Please log in.' };
  }
  if (raw && raw.length <= 200 && !DATABASE_LEAK.test(raw) && !/[\r\n]/.test(raw)) {
    return { status: 400, message: raw };
  }
  return { status: 400, message: 'Could not complete that.' };
}
