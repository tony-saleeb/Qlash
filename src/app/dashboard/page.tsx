import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardClient, { type RecentSession } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  // Get current authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/');
  }

  const [quizzesResult, sessionsResult, hostResult] = await Promise.all([
    supabase
      .from('quizzes')
      .select('id, title, description, created_at, questions(count)')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('game_sessions')
      .select('id, pin, created_at, quiz_id, quizzes(title), players(count)')
      .eq('host_id', user.id)
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('hosts').select('plan').eq('id', user.id).maybeSingle(),
  ]);

  const { data: quizzes, error: quizzesError } = quizzesResult;
  const { data: recentSessions, error: sessionsError } = sessionsResult;

  if (quizzesError) {
    console.error('Error fetching quizzes:', quizzesError);
  }
  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
  }

  return (
    <DashboardClient
      initialQuizzes={quizzes || []}
      recentSessions={(recentSessions || []) as RecentSession[]}
      user={user}
      hostPlan={hostResult.data?.plan}
    />
  );
}
