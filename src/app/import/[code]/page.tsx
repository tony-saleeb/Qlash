import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import { importSharedQuizFromForm } from '@/app/actions/quizzes';
import { BrandMark } from '@/components/brand/BrandMark';
import { ClearPendingImport } from '@/app/import/[code]/ClearPendingImport';
import { isShareCode } from '@/lib/content/shareCode';
import { getSharedQuizPreview } from '@/lib/content/sharedQuizPreview';
import { readRequestLocale } from '@/lib/i18n/requestLocale';
import { t } from '@/lib/i18n/messages';

export const dynamic = 'force-dynamic';

export default async function ImportQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const locale = await readRequestLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  if (!isShareCode(code)) {
    return (
      <div dir={dir} className="flex min-h-dvh flex-col items-center justify-center bg-arena-canvas px-6 text-center">
        <BrandMark size="sm" />
        <h1 className="mt-8 font-display text-3xl font-extrabold">{t(locale, 'couldNotImport')}</h1>
        <p className="mt-3 max-w-md text-sm text-arena-ink/60">{t(locale, 'invalidShareCode')}</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center border-2 border-arena-ink bg-white px-5 font-bold"
        >
          {t(locale, 'library')}
        </Link>
      </div>
    );
  }

  const { user } = await readHostAuth();
  if (!user) {
    redirect(`/?import=${encodeURIComponent(code)}`);
  }

  const preview = await getSharedQuizPreview(code);
  if (!preview) {
    return (
      <div dir={dir} className="flex min-h-dvh flex-col items-center justify-center bg-arena-canvas px-6 text-center">
        <BrandMark size="sm" />
        <h1 className="mt-8 font-display text-3xl font-extrabold">{t(locale, 'couldNotImport')}</h1>
        <p className="mt-3 max-w-md text-sm text-arena-ink/60">{t(locale, 'invalidShareCode')}</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center border-2 border-arena-ink bg-white px-5 font-bold"
        >
          {t(locale, 'library')}
        </Link>
      </div>
    );
  }

  return (
    <div dir={dir} className="flex min-h-dvh flex-col items-center justify-center bg-arena-canvas px-6 text-center">
      <ClearPendingImport />
      <BrandMark size="sm" />
      <p className="mt-8 text-xs font-bold uppercase tracking-wider text-arena-ink/50">{t(locale, 'sharedQuiz')}</p>
      <h1 dir="auto" className="mt-3 font-display text-3xl font-extrabold">
        {preview.title}
      </h1>
      <p className="mt-3 text-sm font-semibold text-arena-ink/60">
        {preview.questionCount} {t(locale, 'questionsWord')}
        {preview.teamMode ? ` · ${t(locale, 'teamMode')}` : ''}
      </p>
      <p className="mt-4 max-w-md text-sm text-arena-ink/60">{t(locale, 'importConfirm')}</p>
      <form action={importSharedQuizFromForm} className="mt-8">
        <input type="hidden" name="code" value={preview.shareCode} />
        <button
          type="submit"
          className="inline-flex h-11 items-center border-2 border-arena-ink bg-arena-acid px-5 font-bold text-arena-ink"
        >
          {t(locale, 'importQuiz')}
        </button>
      </form>
      <Link href="/dashboard" className="mt-4 text-sm font-bold text-arena-ink/60">
        {t(locale, 'library')}
      </Link>
    </div>
  );
}
