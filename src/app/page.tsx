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

export default function LandingPage() {
  const router = useRouter();
  const supabase = createClient();

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
        router.push('/dashboard');
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
            emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      toast.success(result.reconnected ? `Reconnected as ${nickname}` : 'You are in the lobby');
      router.push(`/play/${result.sessionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not join. Try again.');
    } finally {
      setPlayLoading(false);
    }
  };

  return (
    <div className="arena-noise relative min-h-screen overflow-hidden bg-arena-canvas">
      {/* Full-bleed ink plane — dominant visual edge */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-arena-ink lg:block">
        <div className="absolute inset-0 arena-grid opacity-30" />
        <div className="absolute -left-8 top-1/2 w-[min(28vw,380px)] -translate-y-1/2">
          <ArenaFloor />
        </div>
        <div className="absolute bottom-10 left-10 right-10">
          <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-arena-acid">
            Live room · 80 players · zero accounts
          </p>
        </div>
      </div>

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:max-w-none lg:px-10">
        <BrandMark />
        {currentHost ? (
          <Link
            href="/dashboard"
            prefetch
            className="inline-flex h-11 items-center border-2 border-arena-ink bg-white px-4 text-sm font-bold text-arena-ink transition hover:bg-arena-ink hover:text-white"
          >
            Library
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setPanel('host')}
            className="text-sm font-bold text-arena-ink/60 underline-offset-4 hover:text-arena-ink hover:underline"
          >
            Host sign in
          </button>
        )}
      </header>

      <main className="relative z-20 grid min-h-[calc(100vh-5.5rem)] lg:grid-cols-12">
        <section className="flex flex-col justify-center px-6 pb-10 pt-4 lg:col-span-6 lg:px-10 lg:pb-20 lg:pt-6 xl:col-span-5">
          <p className="motion-rise arena-chip mb-6 w-fit bg-arena-acid">Pin. Lock. Clash.</p>
          <h1 className="motion-rise font-display text-[clamp(3.25rem,8vw,5.75rem)] font-extrabold leading-[0.88] tracking-[-0.05em] text-arena-ink">
            Qlash
          </h1>
          <p className="motion-rise-delay mt-6 max-w-sm text-lg font-medium leading-snug text-arena-ink/65">
            Pin in. Lock answers. Own the board — built for the classroom rush.
          </p>

          <div className="motion-rise-delay-2 mt-9 flex flex-wrap gap-3">
            <button type="button" className="arena-cta" onClick={() => setPanel('join')}>
              Join a game
            </button>
            <button type="button" className="arena-cta-secondary" onClick={() => setPanel('host')}>
              Host a room
            </button>
          </div>

          {/* Mobile arena floor */}
          <div className="motion-rise-delay-2 mx-auto mt-12 w-full max-w-xs lg:hidden">
            <ArenaFloor />
          </div>
        </section>

        <section className="flex items-end px-6 pb-12 lg:col-span-6 lg:items-center lg:justify-end lg:px-10 lg:pb-20 xl:col-span-7">
          <div className="motion-rise-delay w-full max-w-md lg:mr-[min(4vw,2rem)]">
            <div className="arena-panel overflow-hidden">
              <div className="flex border-b-2 border-arena-ink">
                <button
                  type="button"
                  onClick={() => setPanel('join')}
                  className={`flex-1 py-3.5 text-center font-display text-sm font-extrabold uppercase tracking-wide transition ${
                    panel === 'join' ? 'bg-arena-ink text-white' : 'bg-white text-arena-ink/40 hover:text-arena-ink'
                  }`}
                >
                  Player
                </button>
                <button
                  type="button"
                  onClick={() => setPanel('host')}
                  className={`flex-1 border-l-2 border-arena-ink py-3.5 text-center font-display text-sm font-extrabold uppercase tracking-wide transition ${
                    panel === 'host' ? 'bg-arena-ink text-white' : 'bg-white text-arena-ink/40 hover:text-arena-ink'
                  }`}
                >
                  Host
                </button>
              </div>

              <div className="bg-white p-6 sm:p-7">
                {panel === 'join' ? (
                  <form onSubmit={handlePlayerJoin} className="space-y-4">
                    <div>
                      <Label htmlFor="pin" className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-ink/45">
                        Game PIN
                      </Label>
                      <Input
                        id="pin"
                        placeholder="······"
                        maxLength={6}
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        className="mt-2 h-16 border-2 border-arena-ink bg-arena-mist/40 text-center font-display text-3xl font-extrabold tracking-[0.4em] focus-visible:ring-arena-court"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nickname" className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-ink/45">
                        Nickname
                      </Label>
                      <Input
                        id="nickname"
                        placeholder="Name on the board"
                        maxLength={15}
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="mt-2 h-12 border-2 border-arena-ink/20 font-semibold focus-visible:border-arena-ink focus-visible:ring-arena-court"
                      />
                    </div>
                    {isTeamQuiz && (
                      <div>
                        <Label htmlFor="teamName" className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-court">
                          Team
                        </Label>
                        <Input
                          id="teamName"
                          placeholder="Team name"
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
                      className="h-13 mt-2 h-12 w-full rounded-none bg-arena-signal font-display text-base font-extrabold text-white hover:bg-arena-signal/90"
                    >
                      {playLoading ? 'Entering…' : 'Jump in'}
                    </Button>
                  </form>
                ) : currentHost ? (
                  <div className="space-y-4 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-ink/40">Signed in</p>
                    <p className="truncate font-display text-lg font-bold">{currentHost.email}</p>
                    <Link
                      href="/dashboard"
                      prefetch
                      className="inline-flex h-12 w-full items-center justify-center bg-arena-ink font-display font-extrabold text-white hover:bg-arena-ink/90"
                    >
                      Open quiz library
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
                      Sign out
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
                          options: { redirectTo: `${window.location.origin}/auth/callback` },
                        });
                        if (error) {
                          toast.error(error.message);
                          setAuthLoading(false);
                        }
                      }}
                      className="h-12 w-full rounded-none border-2 border-arena-ink bg-white font-bold text-arena-ink hover:bg-arena-mist"
                    >
                      Continue with Google
                    </Button>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-arena-line" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-arena-ink/35">or email</span>
                      <div className="h-px flex-1 bg-arena-line" />
                    </div>
                    <form onSubmit={handleHostAuth} className="space-y-3">
                      {authMode === 'signup' && (
                        <Input
                          placeholder="Display name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="h-11 rounded-none border-2 border-arena-ink/20"
                        />
                      )}
                      <Input
                        placeholder="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-none border-2 border-arena-ink/20"
                      />
                      <Input
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-none border-2 border-arena-ink/20"
                      />
                      <Button
                        type="submit"
                        disabled={authLoading}
                        className="h-12 w-full rounded-none bg-arena-court font-display font-extrabold text-white hover:bg-arena-court/90"
                      >
                        {authLoading ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create host account'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                        className="w-full text-center text-xs font-semibold text-arena-ink/50 underline-offset-4 hover:underline"
                      >
                        {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="relative z-30 overflow-hidden border-y-2 border-arena-ink bg-arena-acid py-3.5">
        <div className="motion-slide-x flex w-max gap-12 whitespace-nowrap font-display text-sm font-extrabold uppercase tracking-[0.22em] text-arena-ink">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex gap-12 px-6">
              <span>Pin · Play · Score</span>
              <span>Qlash</span>
              <span>80 players</span>
              <span>Projector ready</span>
              <span>Lock answers fast</span>
              <span>Team mode</span>
              <span>Pin · Play · Score</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
