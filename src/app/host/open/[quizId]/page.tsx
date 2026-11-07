import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import { createLiveLobby } from '@/lib/host/createLiveLobby';

export const dynamic = 'force-dynamic';

interface OpenHostPageProps {
  params: Promise<{
    quizId: string;
  }>;
}

export default async function OpenHostPage({ params }: OpenHostPageProps) {
  const { quizId } = await params;
  if (!quizId) {
    redirect('/dashboard');
  }

  const { user } = await readHostAuth();
  if (!user) {
    redirect('/');
  }

  const session = await createLiveLobby(quizId);
  redirect(`/host/${session.id}`);
}
