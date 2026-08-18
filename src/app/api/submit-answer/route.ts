import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/game/constants';

export const dynamic = 'force-dynamic';

const RPC_ERROR_MAP: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: { status: 401, message: 'Unauthorized. Invalid player token.' },
  SESSION_NOT_FOUND: { status: 404, message: 'Game session not found.' },
  SUBMISSIONS_CLOSED: { status: 403, message: 'Submissions are closed for this round.' },
  CLOCK_NOT_STARTED: { status: 403, message: 'Question clock not started.' },
  WRONG_QUESTION: { status: 403, message: 'This question is not the active round.' },
  QUESTION_NOT_FOUND: { status: 404, message: 'Question not found.' },
  INVALID_ANSWER: { status: 400, message: 'Invalid answer payload.' },
};

function mapRpcError(message: string) {
  for (const key of Object.keys(RPC_ERROR_MAP)) {
    if (message.includes(key)) return RPC_ERROR_MAP[key];
  }
  return null;
}

/**
 * Ultra-fast submit: one Postgres RPC round-trip (auth + grade + insert).
 */
export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const ipLimit = await rateLimit({
      key: `submit:${ip}`,
      limit: RATE_LIMITS.submitPerIp.limit,
      windowMs: RATE_LIMITS.submitPerIp.windowMs,
    });
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: 'Too many submissions from this network. Please wait.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec) } }
      );
    }

    const body = await request.json();
    const { sessionId, playerId, token, questionId, selectedAnswerIds } = body;

    if (!sessionId || !playerId || !token || !questionId || !selectedAnswerIds) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    if (!Array.isArray(selectedAnswerIds) || selectedAnswerIds.length === 0 || selectedAnswerIds.length > 6) {
      return NextResponse.json({ error: 'Invalid answer payload.' }, { status: 400 });
    }

    const playerLimit = await rateLimit({
      key: `submit:player:${playerId}`,
      limit: RATE_LIMITS.submitPerPlayer.limit,
      windowMs: RATE_LIMITS.submitPerPlayer.windowMs,
    });
    if (!playerLimit.ok) {
      return NextResponse.json(
        { error: 'Slow down — answer already being processed.' },
        { status: 429, headers: { 'Retry-After': String(playerLimit.retryAfterSec) } }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('submit_live_answer', {
      p_player_id: playerId,
      p_token: token,
      p_session_id: sessionId,
      p_question_id: questionId,
      p_selected: selectedAnswerIds,
    });

    if (error) {
      const mapped = mapRpcError(error.message || '');
      if (mapped) {
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
      }
      // RPC missing — tell operator to run migration
      if ((error.message || '').toLowerCase().includes('function') && (error.message || '').includes('submit_live_answer')) {
        console.error('submit_live_answer RPC missing — run schema-fast-submit.sql');
        return NextResponse.json(
          { error: 'Server scoring is not configured. Run schema-fast-submit.sql in Supabase.' },
          { status: 503 }
        );
      }
      console.error('submit_live_answer error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const result = data as {
      success?: boolean;
      duplicate?: boolean;
      pointsAwarded?: number;
      isCorrect?: boolean;
    } | null;
    return NextResponse.json({
      success: true,
      message: result?.duplicate ? 'Answer already recorded.' : 'Answer submitted successfully.',
      duplicate: Boolean(result?.duplicate),
      pointsAwarded: result?.pointsAwarded ?? 0,
      isCorrect: Boolean(result?.isCorrect),
    });
  } catch (err: unknown) {
    console.error('Answer submission error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
