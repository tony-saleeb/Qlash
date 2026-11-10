import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import QuizEditorClient from '@/app/dashboard/quizzes/[id]/edit/QuizEditorClient';
import { questionsFailedToLoad } from '@/app/dashboard/quizzes/[id]/edit/quizEditorModel';
import { readRequestLocale } from '@/lib/i18n/requestLocale';
import { t } from '@/lib/i18n/messages';

export const dynamic = 'force-dynamic';

interface EditQuizPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditQuizPage({ params }: EditQuizPageProps) {
  const { id: quizId } = await params;
  const { supabase, user } = await readHostAuth();
  if (!user) {
    redirect('/');
  }

  const [quizResult, questionsResult] = await Promise.all([
    supabase.from('quizzes').select('*').eq('id', quizId).eq('host_id', user.id).is('deleted_at', null).single(),
    supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .is('archived_at', null)
      .order('order_index', { ascending: true }),
  ]);

  const { data: quiz, error: quizError } = quizResult;
  if (quizError || !quiz) {
    redirect('/dashboard');
  }

  const { data: questions, error: questionsError } = questionsResult;

  if (questionsFailedToLoad(questionsError, questions) || !questions) {
    console.error('Error fetching quiz questions:', questionsError);
    const locale = await readRequestLocale();
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-6">
        <h1 className="text-xl font-semibold text-arena-ink">{t(locale, 'questionsFailedTitle')}</h1>
        <p className="text-sm text-arena-ink/70">{t(locale, 'questionsFailedBody')}</p>
      </main>
    );
  }

  return (
    <QuizEditorClient
      quiz={quiz}
      initialQuestions={questions}
    />
  );
}
