import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { readRequestLocale } from '@/lib/i18n/requestLocale';
import { t } from '@/lib/i18n/messages';

export default function PodiumNotFound() {
  const locale = readRequestLocale();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-arena-canvas px-6 text-center">
      <BrandMark size="sm" />
      <h1 className="mt-8 font-display text-3xl font-extrabold">{t(locale, 'quizNotFound')}</h1>
      <Link href="/" className="mt-8 inline-flex h-11 items-center border-2 border-arena-ink bg-white px-5 font-bold">
        {t(locale, 'backHome')}
      </Link>
    </div>
  );
}
