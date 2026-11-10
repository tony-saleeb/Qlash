import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  limitPlayerHydrateSharded,
  tooManyIfPlayerHydrateLimited,
  tooManyRequests,
} from '@/lib/api/playerLimit';
import { correctAnswerIds, type AnswerOption } from '@/lib/game/types';

export const dynamic = 'force-dynamic';

function revealedIndex(order: unknown, questionId: string, orderIndex: number): number {
  if (Array.isArray(order)) {
    return order.indexOf(questionId);
  }
  return orderIndex;
}

/** Return the calling player's own submission for a question (token-gated). */
export async function POST(request: Request) {
  try {
    const { sessionId, playerId, token, questionId } = await request.json();

    if (!sessionId || !playerId || !token || !questionId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const limited = await limitPlayerHydrateSharded(request, 'result', playerId);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const admin = createAdminClient();

    const [{ data: tokenRow }, { data: player }, { data: session }] = await Promise.all([
      admin.from('player_tokens').select('client_token').eq('player_id', playerId).maybeSingle(),
      admin
        .from('players')
        .select('id, score, streak')
        .eq('id', playerId)
        .eq('session_id', sessionId)
        .maybeSingle(),
      admin
        .from('game_sessions')
        .select('status, quiz_id, question_order, current_question_index')
        .eq('id', sessionId)
        .maybeSingle(),
    ]);

    if (!tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perPlayer = await tooManyIfPlayerHydrateLimited(playerId, 'result');
    if (perPlayer) return perPlayer;

    if (!player) {
      return NextResponse.json({ error: 'Player not found in this session.' }, { status: 404 });
    }

    const allowed = ['question_reveal', 'leaderboard', 'finished'].includes(session?.status || '');
    if (!session || !allowed) {
      return NextResponse.json({ error: 'Results not available yet.' }, { status: 403 });
    }

    const { data: question } = await admin
      .from('questions')
      .select('id, order_index, answers')
      .eq('id', questionId)
      .eq('quiz_id', session.quiz_id)
      .maybeSingle();

    if (!question) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }

    const idx = revealedIndex(session.question_order, questionId, question.order_index);
    if (!(idx >= 0 && idx <= session.current_question_index)) {
      return NextResponse.json({ error: 'Results not available yet.' }, { status: 403 });
    }

    const { data: submission } = await admin
      .from('answers_submitted')
      .select('points_awarded, is_correct, was_late, selected_answer_ids')
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
      .eq('player_id', playerId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      hadSubmission: Boolean(submission),
      submitted: Boolean(submission),
      submission: submission ?? { points_awarded: 0, is_correct: false, was_late: false },
      player: { score: player.score, streak: player.streak },
      correctAnswerIds: correctAnswerIds((question.answers || []) as AnswerOption[]),
    });
  } catch (err) {
    console.error('Round result error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
