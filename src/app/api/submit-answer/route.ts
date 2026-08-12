import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  gradeAnswer,
  calculatePoints,
  resolveMultiplier,
} from '@/lib/game/scoring';
import type { AnswerOption } from '@/lib/game/types';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit({ key: `submit:${ip}`, limit: 120, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many submissions. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const { sessionId, playerId, token, questionId, selectedAnswerIds } = await request.json();

    if (!sessionId || !playerId || !token || !questionId || !selectedAnswerIds) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: tokenRow, error: tokenError } = await adminSupabase
      .from('player_tokens')
      .select('player_id, client_token')
      .eq('player_id', playerId)
      .maybeSingle();

    if (tokenError || !tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized. Invalid player token.' }, { status: 401 });
    }

    const { data: player, error: playerError } = await adminSupabase
      .from('players')
      .select('id, score, streak, session_id')
      .eq('id', playerId)
      .single();

    if (playerError || !player || player.session_id !== sessionId) {
      return NextResponse.json({ error: 'Unauthorized. Invalid player.' }, { status: 401 });
    }

    const { data: session, error: sessionError } = await adminSupabase
      .from('game_sessions')
      .select('status, current_question_index, question_started_at, quiz_id, active_multiplier')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Game session not found.' }, { status: 404 });
    }

    if (session.status !== 'question_active') {
      return NextResponse.json({ error: 'Submissions are closed for this round.' }, { status: 403 });
    }

    const { data: question, error: questionError } = await adminSupabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .eq('quiz_id', session.quiz_id)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }

    const { data: quizConfig } = await adminSupabase
      .from('quizzes')
      .select('double_points_rounds')
      .eq('id', session.quiz_id)
      .single();

    const validatedMultiplier = resolveMultiplier(
      session.active_multiplier,
      quizConfig?.double_points_rounds,
      questionId,
      session.current_question_index
    );

    const { data: existingSubmission } = await adminSupabase
      .from('answers_submitted')
      .select('id')
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (existingSubmission) {
      return NextResponse.json({ error: 'Answer already submitted for this question.' }, { status: 400 });
    }

    const serverReceivedAt = new Date();
    const startedAt = new Date(session.question_started_at);
    const timeTakenMs = serverReceivedAt.getTime() - startedAt.getTime();
    const timeLimitMs = question.time_limit_seconds * 1000;
    const isLate = timeTakenMs > timeLimitMs + 1500;

    const answers = (question.answers || []) as AnswerOption[];
    const isCorrect = gradeAnswer({
      type: question.type,
      answers,
      selectedAnswerIds,
      isLate,
    });

    const { pointsAwarded } = calculatePoints({
      isCorrect,
      isLate,
      pointsBase: question.points_base,
      scoringType: question.scoring_type,
      timeTakenMs,
      timeLimitMs,
      previousStreak: player.streak,
      multiplier: validatedMultiplier,
    });

    const { error: insertError } = await adminSupabase.from('answers_submitted').insert({
      session_id: sessionId,
      question_id: questionId,
      player_id: playerId,
      selected_answer_ids: selectedAnswerIds,
      time_taken_ms: timeTakenMs,
      points_awarded: pointsAwarded,
      is_correct: isCorrect,
    });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: 'Answer submitted successfully.',
    });
  } catch (err: unknown) {
    console.error('Answer submission error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
