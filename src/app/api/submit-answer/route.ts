import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/game/constants';
import { isUuid, tokenBucketSuffix } from '@/lib/api/ids';
import { readJsonObject } from '@/lib/api/readJsonBody';
import { cleanAnswerSelection } from '@/lib/game/answerSelection';

export const dynamic = 'force-dynamic';

const RPC_ERROR_MAP: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: { status: 401, message: 'Unauthorized. Invalid player token.' },
  SESSION_NOT_FOUND: { status: 404, message: 'Game session not found.' },
  SUBMISSIONS_CLOSED: { status: 403, message: 'Submissions are closed for this round.' },
  QUESTION_PAUSED: { status: 403, message: 'The question is paused.' },
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
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
    }
    const { sessionId, playerId, token, questionId, selectedAnswerIds } = body;

    if (!sessionId || !playerId || !token || !questionId || !selectedAnswerIds) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const selected = cleanAnswerSelection(selectedAnswerIds);
    if (!selected) {
      return NextResponse.json({ error: 'Invalid answer payload.' }, { status: 400 });
    }
    if (!isUuid(sessionId) || !isUuid(playerId) || !isUuid(questionId) || !isUuid(token)) {
      return NextResponse.json({ error: 'Invalid answer payload.' }, { status: 400 });
    }

    // Keyed by the token, so a classmate who only knows the player id fills
    // a different bucket and cannot block the real answer.
    const playerLimit = await rateLimit({
      key: `submit:player:${playerId}:${tokenBucketSuffix(token)}`,
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
      p_selected: selected,
    });

    if (error) {
      const mapped = mapRpcError(error.message || '');
      if (mapped) {
        if (mapped.status === 401) {
          const failed = await rateLimit({
            key: `authfail:${ip}`,
            limit: RATE_LIMITS.submitAuthFailPerIp.limit,
            windowMs: RATE_LIMITS.submitAuthFailPerIp.windowMs,
          });
          if (!failed.ok) {
            return NextResponse.json(
              { error: 'Too many submissions from this network. Please wait.' },
              { status: 429, headers: { 'Retry-After': String(failed.retryAfterSec) } }
            );
          }
        }
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

    const result = data as { duplicate?: boolean } | null;
    return NextResponse.json({
      success: true,
      duplicate: Boolean(result?.duplicate),
      message: result?.duplicate ? 'Answer already recorded.' : 'Answer submitted successfully.',
    });
  } catch (err: unknown) {
    console.error('Answer submission error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
