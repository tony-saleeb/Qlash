import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/game/constants';

export const dynamic = 'force-dynamic';

/** PIN lookup for the join form — does not return session id or PIN list. */
export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = await rateLimit({
      key: `pin:${ip}`,
      limit: RATE_LIMITS.pinLookupPerIp.limit,
      windowMs: RATE_LIMITS.pinLookupPerIp.windowMs,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many PIN checks. Please wait.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const { pin } = await request.json().catch(() => ({ pin: '' }));
    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      return NextResponse.json({ teamMode: false });
    }

    const admin = createAdminClient();
    const { data: session } = await admin
      .from('game_sessions')
      .select('quizzes(team_mode)')
      .eq('pin', pin)
      .maybeSingle();

    const quiz = session as { quizzes: { team_mode: boolean } | { team_mode: boolean }[] | null } | null;
    const meta = Array.isArray(quiz?.quizzes) ? quiz?.quizzes[0] : quiz?.quizzes;
    return NextResponse.json({ teamMode: Boolean(meta?.team_mode) });
  } catch (err) {
    console.error('PIN lookup error:', err);
    return NextResponse.json({ teamMode: false });
  }
}
