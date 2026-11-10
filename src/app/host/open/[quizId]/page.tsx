import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import { OpenLobbyConfirm } from '@/app/host/open/[quizId]/OpenLobbyConfirm';

export const dynamic = 'force-dynamic';

interface OpenHostPageProps {
  params: Promise<{
    quizId: string;
  }>;
}

/** Opening the link only shows the confirm button. The lobby starts on click. */
export default async function OpenHostPage({ params }: OpenHostPageProps) {
  const { quizId } = await params;
  if (!quizId) {
    redirect('/dashboard');
  }

  const { supabase, user } = await readHostAuth();
  if (!user) {
    redirect('/');
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, title')
    .eq('id', quizId)
    .eq('host_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!quiz?.id) {
    redirect('/dashboard');
  }

  return <OpenLobbyConfirm quizId={quiz.id} title={quiz.title || 'Quiz'} />;
}
