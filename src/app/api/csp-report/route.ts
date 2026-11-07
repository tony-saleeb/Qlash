import { NextResponse } from 'next/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { forwardCspReport } from '@/lib/security/csp';

export const dynamic = 'force-dynamic';

const MAX_REPORT_CHARS = 20_000;

/** Browser CSP reports. Forwarded to Sentry when a DSN is configured. */
export async function POST(request: Request) {
  const limited = await rateLimit({
    key: `csp:${clientIpFromRequest(request)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfterSec) },
    });
  }

  const body = (await request.text()).slice(0, MAX_REPORT_CHARS);
  try {
    await forwardCspReport(
      body,
      request.headers.get('content-type') ?? 'application/csp-report',
      process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
    );
  } catch (err) {
    console.error('csp report forward failed', err);
  }
  return new NextResponse(null, { status: 204 });
}
