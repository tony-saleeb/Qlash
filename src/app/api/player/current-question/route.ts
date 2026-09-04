import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitPlayerHydrate, tooManyRequests } from '@/lib/api/playerLimit';
import { sanitizeAnswers, type AnswerOption } from '@/lib/game/types';
import { maybeSeededShuffle } from '@/lib/game/shuffle';

export const dynamic = 'force-dynamic';

/**
 * Hydrate the current public question for a player who missed question:start.
 * Strips is_correct; requires valid client token.
 * Serves active, paused, reveal, and leaderboard so late joiners recover.
 */
export async function POST(request: Request) {
  try {
    const limited = await limitPlayerHydrate(request, 'question');
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const { sessionId, playerId, token } = await request.json();

    if (!sessionId || !playerId || !token) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();

    const [{ data: tokenRow }, { data: player }, { data: session }] = await Promise.all([
      admin.from('player_tokens').select('client_token').eq('player_id', playerId).maybeSingle(),
      admin.from('players').select('id').eq('id', playerId).eq('session_id', sessionId).maybeSingle(),
      admin
        .from('game_sessions')
        .select(
          'status, current_question_index, question_started_at, quiz_id, active_multiplier, question_order'
        )
        .eq('id', sessionId)
        .single(),
    ]);

    if (!tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!player) {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (!['question_active', 'question_paused', 'question_reveal', 'leaderboard'].includes(session.status)) {
      return NextResponse.json({
        success: true,
        status: session.status,
        question: null,
      });
    }

    const order = Array.isArray(session.question_order)
      ? (session.question_order as string[])
      : null;

    let questionQuery = admin
      .from('questions')
      .select(
        'id, type, prompt, media_url, media_type, time_limit_seconds, answers, quizzes(randomize_answers)'
      )
      .eq('quiz_id', session.quiz_id);

    if (order && order[session.current_question_index]) {
      questionQuery = questionQuery.eq('id', order[session.current_question_index]);
    } else {
      questionQuery = questionQuery.eq('order_index', session.current_question_index);
    }

    const { data: question } = await questionQuery.single();

    if (!question) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }

    const quizMeta = question as unknown as {
      quizzes?: { randomize_answers?: boolean } | null;
    };
    const randomizeAnswers = Boolean(quizMeta.quizzes?.randomize_answers);
    const answers = maybeSeededShuffle(
      sanitizeAnswers((question.answers || []) as AnswerOption[]),
      randomizeAnswers,
      `${sessionId}:${question.id}`
    );

    return NextResponse.json({
      success: true,
      status: session.status,
      active_multiplier: session.active_multiplier ?? 1,
      question: {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        media_url: question.media_url,
        media_type: question.media_type,
        time_limit_seconds: question.time_limit_seconds,
        answers,
      },
      server_started_at: session.question_started_at,
    });
  } catch (err) {
    console.error('current-question error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
