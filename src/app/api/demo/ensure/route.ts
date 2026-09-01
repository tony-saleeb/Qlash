import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/game/constants';
import { DEMO_PIN, ensureDemoSession } from '@/lib/game/demoRoom';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = await rateLimit({
    key: `demo:${ip}`,
    limit: RATE_LIMITS.demoEnsurePerIp.limit,
    windowMs: RATE_LIMITS.demoEnsurePerIp.windowMs,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many demo requests. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
    );
  }

  try {
    const admin = createAdminClient();
    const demo = await ensureDemoSession(admin);
    if (!demo) {
      return NextResponse.json({ pin: DEMO_PIN, ready: false }, { status: 503 });
    }
    const { count } = await admin
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', demo.sessionId);
    return NextResponse.json({
      pin: demo.pin,
      sessionId: demo.sessionId,
      ready: true,
      playerCount: count ?? 0,
    });
  } catch {
    return NextResponse.json({ pin: DEMO_PIN, ready: false }, { status: 503 });
  }
}
