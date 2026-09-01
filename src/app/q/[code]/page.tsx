import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { createClient } from '@/lib/supabase/server';
import {
  getSharedQuizPreview,
  quizPreviewUrl,
  quizShareText,
} from '@/lib/content/sharedQuizPreview';
import { whatsAppShareUrl } from '@/lib/game/lobbyLink';
import { readRequestLocale } from '@/lib/i18n/requestLocale';
import { t } from '@/lib/i18n/messages';
import { metadataBaseUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

type PageProps = { params: { code: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const preview = await getSharedQuizPreview(params.code);
  if (!preview) {
    return { title: 'Qlash', robots: { index: false } };
  }
  const description =
    preview.description?.trim() ||
    `${preview.questionCount} questions · Import into Qlash`;
  return {
    title: `${preview.title} | Qlash`,
    description,
    openGraph: {
      title: `${preview.title} | Qlash`,
      description,
    },
  };
}

export default async function SharedQuizPage({ params }: PageProps) {
  const preview = await getSharedQuizPreview(params.code);
  if (!preview) notFound();

  const locale = readRequestLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  const importHref = user ? `/import/${preview.shareCode}` : `/?import=${encodeURIComponent(preview.shareCode)}`;
  const url = quizPreviewUrl(metadataBaseUrl().origin, preview.shareCode);
  const whatsapp = whatsAppShareUrl(quizShareText(locale, preview.title, preview.questionCount, url));

  return (
    <div dir={dir} className="arena-noise relative flex min-h-dvh flex-col bg-arena-canvas text-arena-ink">
      <header className="flex items-center justify-between border-b-2 border-arena-ink bg-white px-4 py-3 sm:px-6">
        <BrandMark size="sm" />
        <Link href="/" className="text-xs font-bold uppercase tracking-wider text-arena-ink/50">
          {t(locale, 'backHome')}
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <p className="arena-chip mb-4 w-fit bg-arena-acid">{t(locale, 'sharedQuiz')}</p>
        <h1 dir="auto" className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          {preview.title}
        </h1>
        {preview.description ? (
          <p dir="auto" className="mt-3 text-sm text-arena-ink/60">
            {preview.description}
          </p>
        ) : null}
        <p className="mt-4 text-sm font-semibold text-arena-ink/50">
          {preview.questionCount} {t(locale, 'questionsWord')}
          {preview.teamMode ? ` · ${t(locale, 'teamMode')}` : ''}
        </p>
        <p className="mt-6 text-sm text-arena-ink/55">{t(locale, 'importQuizHint')}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href={importHref} className="arena-cta text-center">
            {t(locale, 'importQuiz')}
          </Link>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center border-2 border-arena-ink bg-white px-5 text-sm font-bold"
          >
            {t(locale, 'shareWhatsApp')}
          </a>
        </div>
      </main>
    </div>
  );
}
