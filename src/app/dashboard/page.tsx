import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardClient from './DashboardClient';

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

  // Lean select — avoid pulling unused columns on every library open
  const { data: quizzes, error: quizzesError } = await supabase
    .from('quizzes')
    .select('id, title, description, cover_image_url, theme, created_at, questions(count)')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false });

  if (quizzesError) {
    console.error('Error fetching quizzes:', quizzesError);
  }

  return (
    <DashboardClient
      initialQuizzes={quizzes || []}
      user={user}
    />
  );
}
