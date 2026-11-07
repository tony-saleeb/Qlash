/** Per-request nonce. CSP3 ignores 'unsafe-inline' once this is present. */
export function cspNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * Sentry's browser security endpoint. DSN `https://key@host/project`
 * becomes `https://host/api/project/security/?sentry_key=key`.
 */
export function sentrySecurityReportUrl(dsn: string | null | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace(/^\//, '').split('/')[0] ?? '';
    if (!key || !projectId || !url.host) return null;
    return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${encodeURIComponent(key)}`;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(nonce: string, dev = false): string {
  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "'unsafe-inline'",
    dev ? "'unsafe-eval'" : '',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.supabase.co https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ');
}

export async function forwardCspReport(
  body: string,
  contentType: string,
  dsn: string | null | undefined
): Promise<void> {
  const url = sentrySecurityReportUrl(dsn);
  if (!url || !body) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': contentType || 'application/csp-report' },
    body,
  });
}
