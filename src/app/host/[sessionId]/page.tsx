import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import HostGameClient from '@/app/host/[sessionId]/HostGameClient';
import HostClickerClient from '@/app/host/[sessionId]/HostClickerClient';
import { livePlayerCap } from '@/lib/game/constants';
import { isHostClickerView } from '@/lib/game/lateJoin';
import { normalizeLocale } from '@/lib/i18n/locale';

export const dynamic = 'force-dynamic';

interface HostSessionPageProps {
  params: {
    sessionId: string;
  };
  searchParams: {
    view?: string;
  };
}

export default async function HostSessionPage({ params, searchParams }: HostSessionPageProps) {
  const { sessionId } = params;
  const { supabase, user } = await readHostAuth();
  if (!user) {
    redirect('/');
  }

  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select(
      'id, pin, status, current_question_index, question_started_at, quiz_id, host_id, active_multiplier, question_order, late_join_through_index'
    )
    .eq('id', sessionId)
    .single();
  if (sessionError || !session || session.host_id !== user.id) {
    redirect('/dashboard');
  }

  // Fetch quiz, questions, and players all in parallel
  const [quizResult, questionsResult, playersResult, hostResult] = await Promise.all([
    supabase
      .from('quizzes')
      .select('id, title, randomize_questions, randomize_answers, team_mode')
      .eq('id', session.quiz_id)
      .single(),
    supabase
      .from('questions')
      .select(
        'id, type, prompt, media_url, media_type, time_limit_seconds, points_base, scoring_type, answers, order_index'
      )
      .eq('quiz_id', session.quiz_id)
      .order('order_index', { ascending: true }),
    supabase
      .from('players')
      .select('id, session_id, nickname, team_name, score, streak, joined_at, connected')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true }),
    supabase.from('hosts').select('plan, ui_locale').eq('id', user.id).maybeSingle(),
  ]);

  const { data: quiz, error: quizError } = quizResult;
  if (quizError || !quiz) {
    redirect('/dashboard');
  }

  if (questionsResult.error) {
    console.error('Error fetching questions:', questionsResult.error);
  }
  if (playersResult.error) {
    console.error('Error fetching players:', playersResult.error);
  }

  const clicker = isHostClickerView(searchParams.view);
  const initialLocale = normalizeLocale(hostResult.data?.ui_locale);

  return clicker ? (
    <HostClickerClient
      initialSession={session}
      quiz={quiz}
      questions={questionsResult.data || []}
      initialPlayers={playersResult.data || []}
      initialLocale={initialLocale}
    />
  ) : (
    <HostGameClient
      initialSession={session}
      quiz={quiz}
      questions={questionsResult.data || []}
      initialPlayers={playersResult.data || []}
      playerCap={livePlayerCap(hostResult.data?.plan)}
      initialLocale={initialLocale}
    />
  );
}
