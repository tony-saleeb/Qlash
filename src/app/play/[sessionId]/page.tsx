import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import PlayerGameClient from '@/app/play/[sessionId]/PlayerGameClient';

export const dynamic = 'force-dynamic';

interface PlayerSessionPageProps {
  params: {
    sessionId: string;
  };
}

export default async function PlayerSessionPage({ params }: PlayerSessionPageProps) {
  const { sessionId } = params;
  const admin = createAdminClient();

  const { data: session, error } = await admin
    .from('game_sessions')
    .select('id, status, quizzes(team_mode)')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !session) {
    redirect('/play');
  }

  const sessionWithQuiz = session as unknown as {
    quizzes: { team_mode?: boolean } | { team_mode?: boolean }[] | null;
  };
  const quizMeta = Array.isArray(sessionWithQuiz.quizzes)
    ? sessionWithQuiz.quizzes[0]
    : sessionWithQuiz.quizzes;

  return (
    <PlayerGameClient
      sessionId={sessionId}
      initialSessionStatus={session.status}
      teamMode={Boolean(quizMeta?.team_mode)}
    />
  );
}
