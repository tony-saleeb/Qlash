'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { lookupTeamModeByPin } from '@/lib/game/roomByPin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BrandMark } from '@/components/brand/BrandMark';
import { unlockGameAudio } from '@/lib/sounds';
import { LocaleToggle } from '@/components/brand/LocaleToggle';
import { useLocale } from '@/lib/i18n/useLocale';
import { pinFromSearch } from '@/lib/game/lobbyLink';
import type { Locale } from '@/lib/i18n/locale';

export default function PlayJoinClient({ initialLocale }: { initialLocale?: Locale }) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale(initialLocale);
  const pageDir = locale === 'ar' ? 'rtl' : 'ltr';

  const [pin, setPin] = useState('');
  const [inviteLocked, setInviteLocked] = useState(false);
  const [nickname, setNickname] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isTeamQuiz, setIsTeamQuiz] = useState(false);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    const fromLink = pinFromSearch(window.location.search);
    if (fromLink) {
      setPin(fromLink);
      setInviteLocked(true);
    }
  }, []);

  useEffect(() => {
    const checkTeamMode = async () => {
      if (pin.length === 6) {
        setIsTeamQuiz(await lookupTeamModeByPin(pin));
      } else {
        setIsTeamQuiz(false);
      }
    };
    checkTeamMode();
  }, [pin]);

  const handlePlayerJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    void unlockGameAudio();
    if (!pin || pin.length !== 6) {
      toast.error(t('validGamePin'));
      return;
    }
    if (!nickname.trim()) {
      toast.error(t('pickNickname'));
      return;
    }
    if (isTeamQuiz && !teamName.trim()) {
      toast.error(t('needTeamName'));
      return;
    }
    setLoading(true);
    try {
      const { joinOrReconnect } = await import('@/lib/game/joinClient');
      const result = await joinOrReconnect({
        pin,
        nickname: nickname.trim(),
        teamName: isTeamQuiz ? teamName.trim() : undefined,
      });
      toast.success(result.reconnected ? `${t('backInAs')} ${nickname.trim()}` : `${t('youreInAs')} ${nickname.trim()}`);
      router.replace(`/play/${result.sessionId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('joinFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={pageDir} className="arena-noise relative flex min-h-dvh flex-col overflow-x-clip bg-arena-canvas">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-arena-ink" />
      <div className="pointer-events-none absolute end-8 top-24 h-24 w-24 rotate-12 bg-arena-acid" />
      <div className="pointer-events-none absolute start-6 top-36 h-12 w-12 -rotate-6 bg-arena-signal" />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-6 sm:px-6 sm:py-8">
        <button type="button" onClick={() => router.push('/')}>
          <BrandMark tone="light" />
        </button>
        <LocaleToggle locale={locale} onChange={setLocale} tone="light" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <div className="arena-panel motion-rise p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-arena-ink/40">{t('join')}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-arena-ink">{t('jumpIn')}</h1>
          <p className="mt-2 text-sm font-medium text-arena-ink/55">
            {inviteLocked ? t('inviteOnlyHint') : t('joinHint')}
          </p>
          {!online ? (
            <p className="mt-3 border-2 border-arena-ink bg-arena-acid px-3 py-2 text-sm font-bold text-arena-ink">
              {t('youAreOffline')} — {t('connectToJoin')}
            </p>
          ) : null}

          <form onSubmit={handlePlayerJoin} className="mt-6 space-y-4">
            {!inviteLocked && (
              <div>
                <Label htmlFor="pin" className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-ink/45">
                  {t('gamePin')}
                </Label>
                <Input
                  id="pin"
                  placeholder="······"
                  maxLength={6}
                  inputMode="numeric"
                  dir="ltr"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="mt-2 h-14 border-2 border-arena-ink text-center font-display text-2xl font-extrabold tracking-[0.28em] sm:h-16 sm:text-3xl sm:tracking-[0.4em]"
                />
              </div>
            )}
            <div>
              <Label htmlFor="nickname" className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-ink/45">
                {t('nickname')}
              </Label>
              <Input
                id="nickname"
                placeholder={t('nicknamePlaceholder')}
                maxLength={15}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoFocus={inviteLocked}
                className="mt-2 h-12 border-2 border-arena-ink/20 font-semibold"
              />
            </div>
            {isTeamQuiz && (
              <div>
                <Label htmlFor="teamName" className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-court">
                  {t('team')}
                </Label>
                <Input
                  id="teamName"
                  placeholder={t('teamNamePlaceholder')}
                  maxLength={20}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="mt-2 h-12 border-2 border-arena-court/40 font-semibold"
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || !online}
              className="h-12 w-full rounded-none bg-arena-signal font-display font-extrabold text-white hover:bg-arena-signal/90"
            >
              {loading ? t('entering') : t('jumpIn')}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
