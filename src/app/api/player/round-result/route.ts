import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitPlayerHydrate, tooManyIfPlayerHydrateLimited, tooManyRequests } from '@/lib/api/playerLimit';
import { correctAnswerIds, type AnswerOption } from '@/lib/game/types';

export const dynamic = 'force-dynamic';

/** Return the calling player's own submission for a question (token-gated). */
export async function POST(request: Request) {
  try {
    const limited = await limitPlayerHydrate(request, 'result');
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const { sessionId, playerId, token, questionId } = await request.json();

    if (!sessionId || !playerId || !token || !questionId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();

    const [{ data: tokenRow }, { data: session }] = await Promise.all([
      admin.from('player_tokens').select('client_token').eq('player_id', playerId).maybeSingle(),
      admin.from('game_sessions').select('status, quiz_id').eq('id', sessionId).single(),
    ]);

    if (!tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perPlayer = await tooManyIfPlayerHydrateLimited(playerId, 'result');
    if (perPlayer) return perPlayer;

    const allowed = ['question_reveal', 'leaderboard', 'finished'].includes(session?.status || '');
    if (!allowed) {
      return NextResponse.json({ error: 'Results not available yet.' }, { status: 403 });
    }

    const [{ data: submission }, { data: player }, { data: question }] = await Promise.all([
      admin
        .from('answers_submitted')
        .select('points_awarded, is_correct')
        .eq('session_id', sessionId)
        .eq('question_id', questionId)
        .eq('player_id', playerId)
        .maybeSingle(),
      admin.from('players').select('score, streak').eq('id', playerId).single(),
      admin
        .from('questions')
        .select('answers')
        .eq('id', questionId)
        .eq('quiz_id', session?.quiz_id)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      success: true,
      hadSubmission: Boolean(submission),
      submission: submission || { points_awarded: 0, is_correct: false },
      player: player || { score: 0, streak: 0 },
      correctAnswerIds: correctAnswerIds((question?.answers || []) as AnswerOption[]),
    });
  } catch (err) {
    console.error('Round result error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
