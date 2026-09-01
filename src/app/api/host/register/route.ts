import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/game/constants';
import {
  createConfirmedHost,
  HostRegisterError,
  parseHostRegisterInput,
} from '@/lib/host/registerHost';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = await rateLimit({
      key: `register:${ip}`,
      limit: RATE_LIMITS.registerPerIp.limit,
      windowMs: RATE_LIMITS.registerPerIp.windowMs,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many sign-ups. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const input = parseHostRegisterInput(await request.json().catch(() => ({})));
    await createConfirmedHost(createAdminClient(), input);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HostRegisterError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Could not create account.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
