import Link from 'next/link';
import type { Metadata } from 'next';
import { BrandMark, PinDisplay } from '@/components/brand/BrandMark';
import { LobbyQr } from '@/components/brand/LobbyQr';
import { DemoReady } from '@/app/demo/DemoReady';
import { getContentPack } from '@/lib/content/packs';
import { DEMO_PIN } from '@/lib/game/demoRoom';
import { lobbyJoinPath, lobbyJoinUrl } from '@/lib/game/lobbyLink';
import { ANSWER_MARKS } from '@/lib/game/marks';
import { readRequestLocale } from '@/lib/i18n/requestLocale';
import { t } from '@/lib/i18n/messages';
import { metadataBaseUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'Try the demo | Qlash',
  description: 'PIN 100000 is always on. Feel the projector, then join from your phone.',
};

export default function DemoPage() {
  const locale = readRequestLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const warmup = getContentPack('warmup');
  const teaser = warmup?.questions[0];
  const joinUrl = lobbyJoinUrl(metadataBaseUrl().origin, DEMO_PIN);

  return (
    <div dir={dir} className="arena-noise relative flex min-h-dvh flex-col bg-arena-ink text-white">
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <BrandMark tone="light" size="sm" />
        <Link href="/" className="text-xs font-bold uppercase tracking-wider text-white/50">
          {t(locale, 'backHome')}
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 px-4 py-6 sm:px-8 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col items-center gap-5 text-center lg:col-span-5 lg:items-start lg:text-start">
          <p className="arena-chip w-fit bg-arena-acid text-arena-ink">{t(locale, 'demoRoom')}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            {t(locale, 'tryDemo')}
          </h1>
          <p className="max-w-sm text-sm font-medium text-white/55">{t(locale, 'demoTeaser')}</p>
          <div className="w-full max-w-md border-2 border-white bg-white p-4 text-center text-arena-ink shadow-[8px_8px_0_rgba(0,0,0,0.35)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-arena-ink/40">
              {t(locale, 'roomPin')}
            </p>
            <div className="mt-3">
              <PinDisplay pin={DEMO_PIN} large />
            </div>
            <DemoReady playersWord={t(locale, 'players')} notReady={t(locale, 'demoNotReady')} />
          </div>
          <Link href={lobbyJoinPath(DEMO_PIN)} className="arena-cta text-center">
            {t(locale, 'joinDemo')}
          </Link>
        </div>

        <div className="flex flex-col items-center gap-6 lg:col-span-7">
          <LobbyQr value={joinUrl} caption={t(locale, 'scan')} />
          {teaser ? (
            <div className="w-full max-w-xl border-2 border-white/20 bg-black/20 p-5">
              <p dir="auto" className="font-display text-2xl font-extrabold leading-snug">
                {teaser.prompt}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {teaser.answers.map((answer, index) => {
                  const mark = ANSWER_MARKS[index % ANSWER_MARKS.length];
                  return (
                    <div
                      key={answer.text}
                      className="border-2 border-white/15 px-3 py-3 text-start font-semibold"
                      style={{ background: mark.color, color: mark.inkOnMark ? '#0a0c10' : '#fff' }}
                    >
                      <span dir="auto">{answer.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
