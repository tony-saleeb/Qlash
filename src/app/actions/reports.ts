'use server';

import { buildSessionReport, compareSessionReports, type SessionReport } from '@/lib/game/sessionReport';
import { getHostAuth } from '@/lib/supabase/hostAuth';

export async function getSessionReport(sessionId: string): Promise<SessionReport> {
  try {
    const { supabase, user } = await getHostAuth();

    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id, pin, status, created_at, quiz_id, question_order, quizzes(title, team_mode)')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found.');
    }

    const quizMeta = session as unknown as {
      quizzes: { title: string; team_mode: boolean } | { title: string; team_mode: boolean }[] | null;
    };
    const quiz = Array.isArray(quizMeta.quizzes) ? quizMeta.quizzes[0] : quizMeta.quizzes;

    const [{ data: players, error: playersError }, { data: questions, error: questionsError }, { data: answers, error: answersError }] =
      await Promise.all([
        supabase
          .from('players')
          .select('id, nickname, team_name, score, streak')
          .eq('session_id', sessionId)
          .order('score', { ascending: false }),
        session.quiz_id
          ? supabase
              .from('questions')
              .select('id, prompt, type, order_index, answers')
              .eq('quiz_id', session.quiz_id)
              .order('order_index', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('answers_submitted')
          .select('player_id, question_id, selected_answer_ids, points_awarded, is_correct, time_taken_ms')
          .eq('session_id', sessionId),
      ]);

    if (playersError) throw playersError;
    if (questionsError) throw questionsError;
    if (answersError) throw answersError;

    return buildSessionReport({
      session: {
        id: session.id,
        pin: session.pin,
        status: session.status,
        created_at: session.created_at,
        quiz_id: session.quiz_id,
        question_order: session.question_order,
      },
      quizTitle: quiz?.title ?? null,
      teamMode: Boolean(quiz?.team_mode),
      players: players || [],
      questions: questions || [],
      answers: answers || [],
    });
  } catch (err: unknown) {
    console.error('getSessionReport error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to load class report.');
  }
}

export async function getPreviousSessionReport(sessionId: string): Promise<SessionReport | null> {
  try {
    const { supabase, user } = await getHostAuth();
    const { data: current, error } = await supabase
      .from('game_sessions')
      .select('id, quiz_id, created_at')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (error || !current?.quiz_id) return null;

    const { data: previous } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('host_id', user.id)
      .eq('quiz_id', current.quiz_id)
      .eq('status', 'finished')
      .lt('created_at', current.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!previous?.id) return null;
    return getSessionReport(previous.id);
  } catch {
    return null;
  }
}

export { compareSessionReports };
