'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createGameSession } from '@/lib/host/hostApi';
import { useLocale } from '@/lib/i18n/useLocale';

export function OpenLobbyConfirm({ quizId, title }: { quizId: string; title: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const open = async () => {
    if (pending) return;
    setPending(true);
    try {
      const session = await createGameSession(quizId);
      router.push(`/host/${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('failedOpenLobby'));
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-arena-canvas px-6 text-center">
      <h1 dir="auto" className="font-display text-3xl font-extrabold">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-sm text-arena-ink/60">{t('openLobbyHint')}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => void open()}
        className="mt-8 inline-flex h-11 items-center border-2 border-arena-ink bg-arena-acid px-5 font-bold text-arena-ink disabled:opacity-60"
      >
        {t('openLobby')}
      </button>
      <Link href="/dashboard" className="mt-4 text-sm font-bold text-arena-ink/60">
        {t('library')}
      </Link>
    </div>
  );
}
