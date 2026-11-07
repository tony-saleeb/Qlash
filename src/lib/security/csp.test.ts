import { describe, expect, it, vi } from 'vitest';
import { contentSecurityPolicy, forwardCspReport, sentrySecurityReportUrl } from '@/lib/security/csp';

describe('content security policy', () => {
  it('enforces a nonce and lets Supabase video play', () => {
    const policy = contentSecurityPolicy('noncevalue', false);
    expect(policy).toContain("script-src 'self' 'nonce-noncevalue' 'strict-dynamic' 'unsafe-inline'");
    expect(policy).toContain('media-src \'self\' blob: https://*.supabase.co https:');
    expect(policy).toContain('report-uri /api/csp-report');
    expect(policy).toContain('report-to csp-endpoint');
    expect(policy).not.toContain('unsafe-eval');
  });

  it('allows the dev compiler only in development', () => {
    expect(contentSecurityPolicy('n', true)).toContain("'unsafe-eval'");
  });

  it('turns a Sentry DSN into the CSP security endpoint', () => {
    expect(sentrySecurityReportUrl('https://public-key@o123.ingest.sentry.io/456')).toBe(
      'https://o123.ingest.sentry.io/api/456/security/?sentry_key=public-key'
    );
    expect(sentrySecurityReportUrl('')).toBeNull();
    expect(sentrySecurityReportUrl('not a url')).toBeNull();
  });

  it('forwards a report to Sentry and skips an empty DSN', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await forwardCspReport('{"csp-report":{}}', 'application/csp-report', 'https://key@o1.ingest.sentry.io/9');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://o1.ingest.sentry.io/api/9/security/?sentry_key=key',
      expect.objectContaining({ method: 'POST', body: '{"csp-report":{}}' })
    );
    fetchMock.mockClear();
    await forwardCspReport('{"csp-report":{}}', 'application/csp-report', undefined);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
