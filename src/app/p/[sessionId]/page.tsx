import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { getFinishedPodium, podiumUrl, podiumShareText } from '@/lib/game/podiumShare';
import { whatsAppShareUrl } from '@/lib/game/lobbyLink';
import { readRequestLocale } from '@/lib/i18n/requestLocale';
import { t } from '@/lib/i18n/messages';
import { metadataBaseUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

type PageProps = { params: { sessionId: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const podium = await getFinishedPodium(params.sessionId);
  if (!podium) {
    return { title: 'Qlash', robots: { index: false } };
  }
  const names = podium.top.map((place) => place.nickname).join(' · ');
  const description = names || 'Final podium';
  return {
    title: `${podium.quizTitle} · ${t('en', 'podium')} | Qlash`,
    description,
    openGraph: {
      title: `${podium.quizTitle} | Qlash`,
      description,
    },
  };
}

export default async function PodiumSharePage({ params }: PageProps) {
  const podium = await getFinishedPodium(params.sessionId);
  if (!podium) notFound();

  const locale = readRequestLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const url = podiumUrl(metadataBaseUrl().origin, podium.sessionId);
  const whatsapp = whatsAppShareUrl(podiumShareText(locale, podium.quizTitle, podium.top, url));
  const first = podium.top[0];
  const second = podium.top[1];
  const third = podium.top[2];

  return (
    <div dir={dir} className="arena-stage flex min-h-dvh flex-col text-white">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <BrandMark tone="light" size="sm" />
        <Link href="/" className="text-xs font-bold uppercase tracking-wider text-white/45">
          {t(locale, 'backHome')}
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-arena-acid">{t(locale, 'podium')}</p>
        <h1 className="mt-3 text-center font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          {t(locale, 'championsOf')}{' '}
          <span dir="auto" className="text-arena-acid">
            {podium.quizTitle}
          </span>
        </h1>

        <div className="mt-12 flex w-full min-w-0 items-end justify-center gap-2 sm:gap-6">
          {second ? (
            <Place rank={2} nickname={second.nickname} score={second.score} height="h-32" tone="bg-[#4a2aff]" />
          ) : null}
          {first ? (
            <Place rank={1} nickname={first.nickname} score={first.score} height="h-44" tone="bg-arena-signal" />
          ) : null}
          {third ? (
            <Place rank={3} nickname={third.nickname} score={third.score} height="h-24" tone="bg-arena-court" />
          ) : null}
        </div>

        <div className="mt-12 flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 flex-1 items-center justify-center bg-arena-acid px-5 text-sm font-extrabold text-arena-ink"
          >
            {t(locale, 'shareWhatsApp')}
          </a>
          <Link
            href="/"
            className="inline-flex h-12 flex-1 items-center justify-center border-2 border-white/20 px-5 text-sm font-bold text-white"
          >
            {t(locale, 'hostARoom')}
          </Link>
        </div>
      </main>
    </div>
  );
}

function Place({
  rank,
  nickname,
  score,
  height,
  tone,
}: {
  rank: number;
  nickname: string;
  score: number;
  height: string;
  tone: string;
}) {
  return (
    <div className="flex w-1/3 min-w-0 max-w-[10rem] flex-col items-center gap-3">
      <div className="w-full min-w-0 text-center">
        <p dir="auto" className="truncate font-display text-sm font-extrabold sm:text-base">
          {nickname}
        </p>
        <p className="font-display text-xs font-bold tabular-nums text-arena-acid">{score.toLocaleString()}</p>
      </div>
      <div className={`flex w-full items-center justify-center border-2 border-white/20 ${height} ${tone}`}>
        <span className="font-display text-4xl font-black">{rank}</span>
      </div>
    </div>
  );
}
