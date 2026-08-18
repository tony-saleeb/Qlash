import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PlayerGameClient from '@/app/play/[sessionId]/PlayerGameClient';

export const dynamic = 'force-dynamic';

interface PlayerSessionPageProps {
  params: {
    sessionId: string;
  };
}

export default async function PlayerSessionPage({ params }: PlayerSessionPageProps) {
  const { sessionId } = params;
  const supabase = createClient();

  const { data: session, error } = await supabase
    .from('game_sessions')
    .select('id, status, quizzes(team_mode)')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    redirect('/play');
  }

  const sessionWithQuiz = session as unknown as {
    quizzes: { team_mode?: boolean } | null;
  };

  return (
    <PlayerGameClient
      sessionId={sessionId}
      initialSessionStatus={session.status}
      teamMode={Boolean(sessionWithQuiz?.quizzes?.team_mode)}
    />
  );
}
