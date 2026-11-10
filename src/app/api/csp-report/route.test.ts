import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '@/test/supabaseMock';

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn((..._args: unknown[]): { ok: boolean; retryAfterSec?: number } => ({ ok: true })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  clientIpFromRequest: () => 'test-ip',
}));

const forward = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock('@/lib/security/csp', () => ({
  forwardCspReport: (...args: unknown[]) => forward(...args),
}));

describe('POST /api/csp-report', () => {
  beforeEach(() => {
    rateLimitMock.mockReset();
    rateLimitMock.mockReturnValue({ ok: true });
    forward.mockClear();
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it('accepts a report and forwards it when Sentry is configured', async () => {
    process.env.SENTRY_DSN = 'https://key@o1.ingest.sentry.io/9';
    const { POST } = await import('@/app/api/csp-report/route');
    const response = await POST(
      jsonRequest({ 'csp-report': { 'blocked-uri': 'https://evil.example/app.js' } })
    );
    expect(response.status).toBe(204);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'csp:test-ip', limit: 30 })
    );
    expect(forward).toHaveBeenCalledWith(
      expect.stringContaining('evil.example'),
      'application/json',
      'https://key@o1.ingest.sentry.io/9'
    );
  });

  it('refuses a flood of reports', async () => {
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSec: 8 });
    const { POST } = await import('@/app/api/csp-report/route');
    const response = await POST(jsonRequest({ 'csp-report': {} }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('8');
    expect(forward).not.toHaveBeenCalled();
  });
});
