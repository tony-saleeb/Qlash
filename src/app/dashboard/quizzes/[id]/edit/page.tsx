import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import QuizEditorClient from '@/app/dashboard/quizzes/[id]/edit/QuizEditorClient';

export const dynamic = 'force-dynamic';

interface EditQuizPageProps {
  params: {
    id: string;
  };
}

export default async function EditQuizPage({ params }: EditQuizPageProps) {
  const { id: quizId } = params;
  const { supabase, user } = await readHostAuth();
  if (!user) {
    redirect('/');
  }

  const [quizResult, questionsResult] = await Promise.all([
    supabase.from('quizzes').select('*').eq('id', quizId).eq('host_id', user.id).single(),
    supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index', { ascending: true }),
  ]);

  const { data: quiz, error: quizError } = quizResult;
  if (quizError || !quiz) {
    redirect('/dashboard');
  }

  const { data: questions, error: questionsError } = questionsResult;

  if (questionsError) {
    console.error('Error fetching quiz questions:', questionsError);
  }

  return (
    <QuizEditorClient
      quiz={quiz}
      initialQuestions={questions || []}
    />
  );
}
