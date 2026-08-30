'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';
import { ArenaFloor, BrandMark } from '@/components/brand/BrandMark';
import { authCallbackUrl } from '@/lib/siteUrl';
import { unlockGameAudio } from '@/lib/sounds';
import { LocaleToggle } from '@/components/brand/LocaleToggle';
import { useLocale } from '@/lib/i18n/useLocale';
import type { Locale } from '@/lib/i18n/locale';

function hostAuthRedirect(): string {
  const base = authCallbackUrl();
  if (typeof window === 'undefined') return base;
  try {
    const importCode =
      new URLSearchParams(window.location.search).get('import') || sessionStorage.getItem('qlash_import');
    if (importCode) return `${base}?next=${encodeURIComponent(`/import/${importCode}`)}`;
  } catch {
    // ignore
  }
  return base;
}

export default function LandingClient({ initialLocale }: { initialLocale?: Locale }) {
  const router = useRouter();
  const supabase = createClient();
  const { locale, setLocale, t } = useLocale(initialLocale);
  const pageDir = locale === 'ar' ? 'rtl' : 'ltr';

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentHost, setCurrentHost] = useState<User | null>(null);

  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isTeamQuiz, setIsTeamQuiz] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const [panel, setPanel] = useState<'join' | 'host'>('join');

  useEffect(() => {
    const checkTeamMode = async () => {
      if (pin.length === 6) {
        const { data: session } = await supabase
          .from('game_sessions')
          .select('id, quizzes(team_mode)')
          .eq('pin', pin)
          .maybeSingle();
        const sessionWithQuiz = session as unknown as { quizzes: { team_mode: boolean } | null };
        setIsTeamQuiz(Boolean(sessionWithQuiz?.quizzes?.team_mode));
      } else {
        setIsTeamQuiz(false);
      }
    };
    checkTeamMode();
  }, [pin, supabase]);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) setCurrentHost(data.session.user);
    };
    checkSession();
  }, [supabase]);

  useEffect(() => {
    if (currentHost || panel === 'host') router.prefetch('/dashboard');
  }, [currentHost, panel, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const importCode = new URLSearchParams(window.location.search).get('import');
    if (importCode) {
      try {
        sessionStorage.setItem('qlash_import', importCode);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!currentHost || typeof window === 'undefined') return;
    try {
      const importCode = sessionStorage.getItem('qlash_import');
      if (importCode) {
        sessionStorage.removeItem('qlash_import');
        router.push(`/import/${importCode}`);
      }
    } catch {
      // ignore
    }
  }, [currentHost, router]);

  const handleHostAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back.');
        setCurrentHost(data.user);
        const importCode = new URLSearchParams(window.location.search).get('import');
        router.push(importCode ? `/import/${importCode}` : '/dashboard');
      } else {
        if (!displayName) {
          toast.error('Please enter a display name.');
          setAuthLoading(false);
          return;
        }
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: hostAuthRedirect(),
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success('Account ready.');
          setCurrentHost(data.user);
          router.push('/dashboard');
        } else {
          toast.success('Check your email to verify, then sign in.');
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePlayerJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    void unlockGameAudio();
    if (!pin || pin.length !== 6) {
      toast.error('Enter a valid 6-digit game PIN.');
      return;
    }
    if (!nickname.trim()) {
      toast.error('Pick a nickname.');
      return;
    }
    if (isTeamQuiz && !teamName.trim()) {
      toast.error('This game needs a team name.');
      return;
    }
    setPlayLoading(true);
    try {
      const { joinOrReconnect } = await import('@/lib/game/joinClient');
      const result = await joinOrReconnect({
        pin,
        nickname: nickname.trim(),
        teamName: isTeamQuiz ? teamName.trim() : undefined,
      });
      toast.success(result.reconnected ? `Back in as ${nickname.trim()}` : `You're in as ${nickname.trim()}`);
      router.push(`/play/${result.sessionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not join. Try again.');
    } finally {
      setPlayLoading(false);
    }
  };

  return (
    <div dir={pageDir} className="relative flex min-h-dvh flex-col overflow-x-hidden bg-arena-canvas lg:h-dvh lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden arena-noise" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 end-0 z-0 hidden w-[46%] bg-arena-ink lg:block">
        <div className="absolute inset-0 arena-grid opacity-30" />
        <div className="absolute -start-8 top-1/2 w-[min(28vw,380px)] -translate-y-1/2">
          <ArenaFloor />
        </div>
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:max-w-none lg:px-10">
        <BrandMark />
        <div className="flex items-center gap-3">
          <LocaleToggle locale={locale} onChange={setLocale} />
          {currentHost ? (
            <Link
              href="/dashboard"
              prefetch
              className="inline-flex h-11 min-h-11 items-center border-2 border-arena-ink bg-white px-4 text-sm font-bold text-arena-ink transition hover:bg-arena-ink hover:text-white"
            >
              {t('library')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setPanel('host')}
              className="inline-flex h-11 min-h-11 items-center border-2 border-arena-ink bg-white px-4 text-sm font-bold text-arena-ink transition hover:bg-arena-ink hover:text-white"
            >
              {t('hostSignIn')}
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pb-8 pt-1 sm:px-6 lg:mx-0 lg:grid lg:min-h-0 lg:max-w-none lg:flex-1 lg:grid-cols-12 lg:gap-0 lg:px-10 lg:pb-6 lg:pt-0">
        <section
          dir={pageDir}
          className="order-2 flex flex-col justify-center lg:order-1 lg:col-span-6 lg:px-0 lg:py-6 xl:col-span-5"
        >
          <p className={`motion-rise arena-chip mb-3 w-fit bg-arena-acid lg:mb-6 ${locale === 'ar' ? 'normal-case tracking-normal' : ''}`}>
            {t('pinLockClash')}
          </p>
          <h1 className="motion-rise font-display text-4xl font-extrabold leading-[0.88] tracking-[-0.05em] text-arena-ink sm:text-5xl lg:text-[clamp(3.25rem,8vw,5.75rem)]">
            Qlash
          </h1>
          <p className="motion-rise-delay mt-3 max-w-sm text-base font-medium leading-snug text-arena-ink/65 sm:text-lg lg:mt-6">
            {t('heroBody')}
          </p>

          <div className="motion-rise-delay-2 mt-6 hidden flex-wrap gap-3 lg:mt-9 lg:flex">
            <button type="button" className="arena-cta" onClick={() => setPanel('join')}>
              {t('joinAGame')}
            </button>
            <button type="button" className="arena-cta-secondary" onClick={() => setPanel('host')}>
              {t('hostARoom')}
            </button>
          </div>
        </section>

        <section className="order-1 flex items-start lg:order-2 lg:col-span-6 lg:items-center lg:justify-end lg:py-6 xl:col-span-7">
          <div className="motion-rise-delay w-full max-w-md lg:me-[min(4vw,2rem)]">
            <div className="arena-panel overflow-hidden" dir={pageDir}>
              <div className="flex border-b-2 border-arena-ink">
                <button
                  type="button"
                  onClick={() => setPanel('join')}
                  className={`flex-1 min-h-12 py-3.5 text-center font-display text-sm font-extrabold uppercase tracking-wide transition ${
                    panel === 'join' ? 'bg-arena-ink text-white' : 'bg-white text-arena-ink/40 hover:text-arena-ink'
                  }`}
                >
                  {t('playerTab')}
                </button>
                <button
                  type="button"
                  onClick={() => setPanel('host')}
                  className={`flex-1 min-h-12 border-s-2 border-arena-ink py-3.5 text-center font-display text-sm font-extrabold uppercase tracking-wide transition ${
                    panel === 'host' ? 'bg-arena-ink text-white' : 'bg-white text-arena-ink/40 hover:text-arena-ink'
                  }`}
                >
                  {t('hostTab')}
                </button>
              </div>

              <div className="bg-white p-6 sm:p-7">
                {panel === 'join' ? (
                  <form onSubmit={handlePlayerJoin} className="space-y-4">
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
                        className="mt-2 h-14 border-2 border-arena-ink bg-arena-mist/40 text-center font-display text-2xl font-extrabold tracking-[0.28em] focus-visible:ring-arena-court sm:h-16 sm:text-3xl sm:tracking-[0.4em]"
                      />
                    </div>
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
                        className="mt-2 h-12 border-2 border-arena-ink/20 font-semibold focus-visible:border-arena-ink focus-visible:ring-arena-court"
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
                      disabled={playLoading}
                      className="mt-2 h-12 min-h-12 w-full rounded-none bg-arena-signal font-display text-base font-extrabold text-white hover:bg-arena-signal/90"
                    >
                      {playLoading ? t('entering') : t('jumpIn')}
                    </Button>
                  </form>
                ) : currentHost ? (
                  <div className="space-y-4 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-ink/40">{t('signedIn')}</p>
                    <p className="truncate font-display text-lg font-bold">{currentHost.email}</p>
                    <Link
                      href="/dashboard"
                      prefetch
                      className="inline-flex h-12 w-full items-center justify-center bg-arena-ink font-display font-extrabold text-white hover:bg-arena-ink/90"
                    >
                      {t('openLibrary')}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setCurrentHost(null);
                        toast.success('Signed out.');
                      }}
                      className="text-xs font-semibold text-arena-ink/45 underline-offset-4 hover:underline"
                    >
                      {t('signOut')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button
                      type="button"
                      disabled={authLoading}
                      onClick={async () => {
                        setAuthLoading(true);
                        const { error } = await supabase.auth.signInWithOAuth({
                          provider: 'google',
                          options: { redirectTo: hostAuthRedirect() },
                        });
                        if (error) {
                          toast.error(error.message);
                          setAuthLoading(false);
                        }
                      }}
                      className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-none border-2 border-arena-ink bg-white font-bold text-arena-ink hover:bg-arena-mist"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
                      </svg>
                      {t('continueGoogle')}
                    </Button>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-arena-line" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-arena-ink/35">{t('orEmail')}</span>
                      <div className="h-px flex-1 bg-arena-line" />
                    </div>
                    <form onSubmit={handleHostAuth} className="space-y-3">
                      {authMode === 'signup' && (
                        <Input
                          placeholder={t('displayName')}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="h-11 rounded-none border-2 border-arena-ink/20"
                        />
                      )}
                      <Input
                        placeholder={t('email')}
                        type="email"
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-none border-2 border-arena-ink/20"
                      />
                      <Input
                        placeholder={t('password')}
                        type="password"
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-none border-2 border-arena-ink/20"
                      />
                      <Button
                        type="submit"
                        disabled={authLoading}
                        className="h-12 w-full rounded-none bg-arena-court font-display font-extrabold text-white hover:bg-arena-court/90"
                      >
                        {authLoading ? t('pleaseWait') : authMode === 'login' ? t('signIn') : t('createHost')}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                        className="w-full text-center text-xs font-semibold text-arena-ink/50 underline-offset-4 hover:underline"
                      >
                        {authMode === 'login' ? t('needAccount') : t('haveAccount')}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="relative z-10 mt-auto shrink-0 overflow-hidden border-t-2 border-arena-ink bg-arena-acid py-3">
        <div className={`motion-slide-x flex w-max gap-12 whitespace-nowrap font-display text-sm font-extrabold text-arena-ink ${locale === 'ar' ? 'tracking-normal' : 'uppercase tracking-[0.22em]'}`}>
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex gap-12 px-6">
              <span>{t('pinPlayScore')}</span>
              <span>Qlash</span>
              <span>{t('players80')}</span>
              <span>{t('projectorReady')}</span>
              <span>{t('lockAnswersFast')}</span>
              <span>{t('teamMode')}</span>
              <span>{t('pinPlayScore')}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
