import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import { importSharedQuiz } from '@/app/actions/quizzes';
import { BrandMark } from '@/components/brand/BrandMark';

export const dynamic = 'force-dynamic';

export default async function ImportQuizPage({ params }: { params: { code: string } }) {
  const { user } = await readHostAuth();

  if (!user) {
    redirect(`/?import=${encodeURIComponent(params.code)}`);
  }

  let quiz;
  try {
    quiz = await importSharedQuiz(params.code);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not import that quiz.';
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-arena-canvas px-6 text-center">
        <BrandMark size="sm" />
        <h1 className="mt-8 font-display text-3xl font-extrabold">Could not import</h1>
        <p className="mt-3 max-w-md text-sm text-arena-ink/60">{message}</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center border-2 border-arena-ink bg-white px-5 font-bold"
        >
          Back to library
        </Link>
      </div>
    );
  }

  redirect(`/dashboard/quizzes/${quiz.id}/edit`);
}
