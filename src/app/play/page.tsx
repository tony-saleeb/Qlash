'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BrandMark } from '@/components/brand/BrandMark';
import { unlockGameAudio } from '@/lib/sounds';

export default function PlayerJoinPage() {
  const router = useRouter();
  const supabase = createClient();

  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isTeamQuiz, setIsTeamQuiz] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pinParam = params.get('pin');
      if (pinParam) setPin(pinParam.slice(0, 6).replace(/\D/g, ''));
    }
  }, []);

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
    setLoading(true);
    try {
      const { joinOrReconnect } = await import('@/lib/game/joinClient');
      const result = await joinOrReconnect({
        pin,
        nickname: nickname.trim(),
        teamName: isTeamQuiz ? teamName.trim() : undefined,
      });
      toast.success(result.reconnected ? `Reconnected as ${nickname}` : 'Joined the lobby');
      router.replace(`/play/${result.sessionId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to join. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="arena-noise relative flex min-h-screen flex-col overflow-hidden bg-arena-canvas">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-arena-ink" />
      <div className="pointer-events-none absolute right-8 top-24 h-24 w-24 rotate-12 bg-arena-acid" />
      <div className="pointer-events-none absolute left-6 top-36 h-12 w-12 -rotate-6 bg-arena-signal" />

      <header className="relative z-10 flex justify-center px-6 py-8">
        <button type="button" onClick={() => router.push('/')}>
          <BrandMark tone="light" />
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <div className="arena-panel motion-rise p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-arena-ink/40">Join</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-arena-ink">Jump in</h1>
          <p className="mt-2 text-sm font-medium text-arena-ink/55">PIN from the big screen. Nickname on the board.</p>

          <form onSubmit={handlePlayerJoin} className="mt-6 space-y-4">
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
                className="mt-2 h-16 border-2 border-arena-ink text-center font-display text-3xl font-extrabold tracking-[0.4em]"
              />
            </div>
            <div>
              <Label htmlFor="nickname" className="text-[11px] font-bold uppercase tracking-[0.18em] text-arena-ink/45">
                Nickname
              </Label>
              <Input
                id="nickname"
                placeholder="Your name"
                maxLength={15}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-2 h-12 border-2 border-arena-ink/20 font-semibold"
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
              disabled={loading}
              className="h-12 w-full rounded-none bg-arena-signal font-display font-extrabold text-white hover:bg-arena-signal/90"
            >
              {loading ? 'Joining…' : 'Enter lobby'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
