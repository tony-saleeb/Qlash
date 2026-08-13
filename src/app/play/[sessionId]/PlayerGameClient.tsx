'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updatePlayerConnection } from '@/app/actions/game';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Flame, Wifi, WifiOff, Loader2, Award, CheckCircle, XCircle, Clock, Trophy, Pause, Check, Users, Zap } from 'lucide-react';
import { BrandMark, AnswerButton } from '@/components/brand/BrandMark';
import { playCorrectSound, playIncorrectSound, playFanfareSound } from '@/lib/sounds';
import confetti from 'canvas-confetti';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import {
  SHAPES_MAP,
  type Player,
  type PublicQuestionPayload,
} from '@/lib/game/types';
import { remainingFromPausedElapsed, remainingSeconds, startedAtFromRemaining } from '@/lib/game/clock';
import { aggregateTeamScores } from '@/lib/game/teams';

type ActiveQuestionPayload = PublicQuestionPayload;

interface PlayerGameClientProps {
  sessionId: string;
  initialSessionStatus: string;
  quizTheme?: Record<string, unknown> | null;
  teamMode?: boolean;
}

export default function PlayerGameClient({
  sessionId,
  initialSessionStatus,
  quizTheme,
  teamMode = false,
}: PlayerGameClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // State managers
  const [player, setPlayer] = useState<Player | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>(initialSessionStatus);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [podiumPlayers, setPodiumPlayers] = useState<Player[]>([]);

  // Active question loop variables
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestionPayload | null>(null);
  const [selectedAnswerIds, setSelectedAnswerIds] = useState<string[]>([]);
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'submitted' | 'late'>('idle');
  const [typeInputValue, setTypeInputValue] = useState('');
  const [roundResult, setRoundResult] = useState<{
    isCorrect: boolean;
    pointsAwarded: number;
    correctAnswerIds: string[];
    optionCounts?: Record<string, number>;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [clockStartedAt, setClockStartedAt] = useState<string | null>(null);
  const [finalRank, setFinalRank] = useState<number | null>(null);
  const [activeMultiplier, setActiveMultiplier] = useState<number>(1);

  const playerRef = React.useRef<Player | null>(null);
  const activeQuestionRef = React.useRef<ActiveQuestionPayload | null>(null);
  const lastSubmitRef = React.useRef<{
    questionId: string;
    selected: string[];
    isCorrect: boolean | null;
    pointsAwarded: number;
  } | null>(null);
  const revealAppliedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    playerRef.current = player;
  }, [player]);

  React.useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  const shapesMap = SHAPES_MAP;

  const customStyles = {
    backgroundColor: (quizTheme?.bgColor as string) || '#12151c',
    color: (quizTheme?.textColor as string) || '#f4f6f8',
  };

  const applyQuestionPayload = useCallback(
    (
      question: ActiveQuestionPayload,
      serverStartedAt?: string | null,
      status?: string
    ) => {
      setActiveQuestion(question);
      lastSubmitRef.current = null;
      revealAppliedRef.current = null;

      if (serverStartedAt && question.time_limit_seconds) {
        setClockStartedAt(serverStartedAt);
        setTimeLeft(remainingSeconds(serverStartedAt, question.time_limit_seconds));
      } else {
        setClockStartedAt(null);
        setTimeLeft(question.time_limit_seconds);
      }

      setSelectedAnswerIds([]);
      setTypeInputValue('');
      setSubmissionState('idle');
      setRoundResult(null);
      if (status) setSessionStatus(status);
    },
    []
  );

  const hydrateCurrentQuestion = useCallback(
    async (playerId: string) => {
      const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
      try {
        const res = await fetch('/api/player/current-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, playerId, token }),
        });
        const data = await res.json();
        if (!res.ok) return;

        if (data.status) setSessionStatus(data.status);
        if (typeof data.active_multiplier === 'number') {
          setActiveMultiplier(data.active_multiplier);
        }
        if (data.question) {
          applyQuestionPayload(data.question, data.server_started_at, data.status);
        }
      } catch (err) {
        console.error('Failed to hydrate current question', err);
      }
    },
    [sessionId, applyQuestionPayload]
  );

  const syncOfficialScore = useCallback(
    async (playerId: string, questionId: string) => {
      const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
      try {
        const res = await fetch('/api/player/round-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, playerId, token, questionId }),
        });
        const data = await res.json();
        if (!res.ok) return;
        if (data.player) {
          setPlayer((prev) =>
            prev ? { ...prev, score: data.player.score, streak: data.player.streak } : null
          );
        }
        if (data.submission) {
          setRoundResult((prev) =>
            prev
              ? {
                  ...prev,
                  isCorrect: data.submission.is_correct ?? prev.isCorrect,
                  pointsAwarded: data.submission.points_awarded ?? prev.pointsAwarded,
                }
              : prev
          );
        }
      } catch (err) {
        console.error('Failed to sync official score', err);
      }
    },
    [sessionId]
  );

  const applyRevealInstant = useCallback(
    (correctAnswerIds: string[], optionCounts?: Record<string, number>) => {
      const currentQ = activeQuestionRef.current;
      const qid = currentQ?.id;
      if (qid && revealAppliedRef.current === qid) {
        if (correctAnswerIds.length) {
          setRoundResult((prev) =>
            prev
              ? {
                  ...prev,
                  correctAnswerIds,
                  optionCounts: optionCounts ?? prev.optionCounts,
                }
              : prev
          );
        }
        return;
      }
      if (qid) revealAppliedRef.current = qid;
      const submit = lastSubmitRef.current;
      const selected =
        submit?.questionId === currentQ?.id ? submit.selected : [];

      let isCorrect = false;
      let pointsAwarded = 0;
      if (submit?.questionId === currentQ?.id && submit.isCorrect !== null) {
        isCorrect = submit.isCorrect;
        pointsAwarded = submit.pointsAwarded;
      } else if (currentQ?.type !== 'poll' && selected.length > 0) {
        const sel = [...selected].sort();
        const cor = [...correctAnswerIds].sort();
        isCorrect = sel.length === cor.length && sel.every((id, i) => id === cor[i]);
      }

      if (isCorrect) playCorrectSound();
      else playIncorrectSound();

      setRoundResult({
        isCorrect,
        pointsAwarded,
        correctAnswerIds,
        optionCounts,
      });
      setSessionStatus('question_reveal');
      setSubmissionState('idle');

      const playerId = playerRef.current?.id;
      if (playerId && currentQ) {
        void syncOfficialScore(playerId, currentQ.id);
      }
    },
    [syncOfficialScore]
  );

  useSessionChannel(sessionId, {
    supabase,
    onEvents: {
      'question:start': (msg) => {
        const payload = msg.payload;
        const questionId = payload.question_id as string | undefined;
        if (!questionId) return;
        applyQuestionPayload(
          {
            id: questionId,
            type: payload.type as string,
            prompt: payload.prompt as string,
            media_url: (payload.media_url as string | null) ?? null,
            media_type: (payload.media_type as string | null) ?? null,
            time_limit_seconds: payload.time_limit_seconds as number,
            answers: payload.answers as ActiveQuestionPayload['answers'],
          },
          (payload.server_started_at as string) || new Date().toISOString(),
          'question_active'
        );
        setActiveMultiplier(1);
      },
      'question:reveal': (msg) => {
        const correctIds = (msg.payload.correct_answer_ids as string[]) || [];
        const optionCounts = msg.payload.option_counts as Record<string, number> | undefined;
        applyRevealInstant(correctIds, optionCounts);
      },
      'timer:sync': (msg) => {
        const status = msg.payload.status as string | undefined;
        const startedAt = msg.payload.server_started_at as string | undefined;
        const remaining = msg.payload.remaining_seconds as number | undefined;
        const limit = activeQuestionRef.current?.time_limit_seconds;
        if (status) setSessionStatus(status);
        if (typeof remaining === 'number') {
          setTimeLeft(Math.max(0, remaining));
          if (status === 'question_active' && limit) {
            setClockStartedAt(startedAtFromRemaining(limit, remaining));
          }
        } else if (startedAt && limit) {
          if (status === 'question_paused') {
            setTimeLeft(remainingFromPausedElapsed(startedAt, limit));
          } else {
            setClockStartedAt(startedAt);
            setTimeLeft(remainingSeconds(startedAt, limit));
          }
        }
      },
      'question:update': (msg) => {
        setActiveQuestion((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            prompt: (msg.payload.prompt as string) || prev.prompt,
            answers: msg.payload.answers
              ? prev.answers.map((ans) => {
                  const updated = (
                    msg.payload.answers as { id: string; text: string }[]
                  ).find((a) => a.id === ans.id);
                  return updated ? { ...ans, text: updated.text } : ans;
                })
              : prev.answers,
          };
        });
        toast.info('The host updated the question.');
      },
      'host:announcement': (msg) => {
        const message = msg.payload.message as string;
        if (message) toast.info(`📢 Host: ${message}`, { duration: 8000 });
      },
      'multiplier:change': (msg) => {
        const multiplier = (msg.payload.multiplier as number) || 1;
        setActiveMultiplier(multiplier);
        if (multiplier > 1) {
          toast.success(`⚡ Double Points activated! (${multiplier}x)`, { duration: 5000 });
        } else {
          toast.info('Multiplier deactivated (1x)');
        }
      },
    },
  });

  // 1. Authenticate player identity via token-gated API (tokens are not publicly readable)
  useEffect(() => {
    const authenticatePlayer = async () => {
      const token = localStorage.getItem(`quizarena_token_${sessionId}`);
      if (!token) {
        toast.error('Session not found. Please join with your PIN.');
        router.push('/play');
        return;
      }

      try {
        const res = await fetch('/api/player/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, token }),
        });
        const data = await res.json();

        if (!res.ok || !data.player) {
          localStorage.removeItem(`quizarena_token_${sessionId}`);
          toast.error('Identity verification failed. Please join again.');
          router.push('/play');
          return;
        }

        setPlayer(data.player as Player);
        if (data.sessionStatus) setSessionStatus(data.sessionStatus);
        setLoading(false);

        await updatePlayerConnection(data.player.id, token, true);
        // Recover mid-question if broadcast was missed (late join / refresh)
        await hydrateCurrentQuestion(data.player.id);
      } catch (err) {
        console.error('Authentication error:', err);
        router.push('/play');
      }
    };

    authenticatePlayer();
  }, [sessionId, router, hydrateCurrentQuestion]);

  // 2. Realtime listener setup for status + kick (broadcast handled by useSessionChannel)
  useEffect(() => {
    if (!player?.id) return;

    const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
    const playerId = player.id;

    const playerChannel = supabase
      .channel(`player_self_${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${playerId}`,
        },
        () => {
          localStorage.removeItem(`quizarena_token_${sessionId}`);
          toast.error('You have been kicked from the lobby by the host.');
          router.push('/play');
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel(`player_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as string;
          setSessionStatus(newStatus);

          if (typeof payload.new.active_multiplier === 'number') {
            setActiveMultiplier(payload.new.active_multiplier);
          }

          const startedAt = payload.new.question_started_at as string | null;
          const limit = activeQuestionRef.current?.time_limit_seconds;

          if (newStatus === 'question_active' || newStatus === 'question_paused') {
            if (!activeQuestionRef.current) {
              hydrateCurrentQuestion(playerId);
            } else if (startedAt && limit) {
              if (newStatus === 'question_paused') {
                setTimeLeft(remainingFromPausedElapsed(startedAt, limit));
              } else {
                setClockStartedAt(startedAt);
                setTimeLeft(remainingSeconds(startedAt, limit));
              }
            }
          } else if (newStatus === 'question_reveal') {
            const q = activeQuestionRef.current;
            revealFallbackTimer = window.setTimeout(() => {
              if (q && revealAppliedRef.current !== q.id) {
                applyRevealInstant([]);
              }
            }, 250);
          }
          } else if (newStatus === 'leaderboard') {
            setRoundResult(null);
          } else if (newStatus === 'finished') {
            fetchFinalRank();
          }
        }
      )
      .subscribe();

    const fetchFinalRank = async () => {
      const { data: allPlayers } = await supabase
        .from('players')
        .select('id, nickname, score')
        .eq('session_id', sessionId)
        .order('score', { ascending: false });

      if (allPlayers) {
        const rank = allPlayers.findIndex((p) => p.id === playerId) + 1;
        setFinalRank(rank);
        setPodiumPlayers(allPlayers as Player[]);
      }
    };

    let revealFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setOnline(isVisible);
      if (connectionTimer) clearTimeout(connectionTimer);
      connectionTimer = setTimeout(() => {
        updatePlayerConnection(playerId, token, isVisible);
        if (isVisible) hydrateCurrentQuestion(playerId);
      }, 400);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => {
      setOnline(true);
      updatePlayerConnection(playerId, token, true);
    });
    window.addEventListener('blur', () => {
      setOnline(false);
      updatePlayerConnection(playerId, token, false);
    });

    return () => {
      if (connectionTimer) clearTimeout(connectionTimer);
      if (revealFallbackTimer) clearTimeout(revealFallbackTimer);
      supabase.removeChannel(playerChannel);
      supabase.removeChannel(sessionChannel);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase, player?.id, sessionId, router, hydrateCurrentQuestion, applyRevealInstant]);

  // Countdown anchored to server start — never decrement independently
  useEffect(() => {
    if (sessionStatus !== 'question_active' || !activeQuestion || !clockStartedAt) return;

    const limit = activeQuestion.time_limit_seconds;
    const started = new Date(clockStartedAt).getTime();
    if (!Number.isFinite(started) || !limit) return;

    const tick = () => {
      setTimeLeft(Math.max(0, Math.ceil(limit - (Date.now() - started) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [sessionStatus, activeQuestion, clockStartedAt]);

  // 3. Trigger confetti and fanfare upon game completion (finished podium)
  useEffect(() => {
    if (sessionStatus === 'finished') {
      playFanfareSound();

      const duration = 5 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#a855f7', '#ec4899', '#3b82f6'],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#a855f7', '#ec4899', '#3b82f6'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [sessionStatus]);

  // Instant lock-in UX — never wait on the network to feel responsive
  const submitAnswer = async (answersToSubmit: string[]) => {
    if (!player || !activeQuestion || submissionState !== 'idle') return;

    const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
    setSelectedAnswerIds(answersToSubmit);
    setSubmissionState('submitted');
    lastSubmitRef.current = {
      questionId: activeQuestion.id,
      selected: answersToSubmit,
      isCorrect: null,
      pointsAwarded: 0,
    };

    try {
      const response = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId: player.id,
          token,
          questionId: activeQuestion.id,
          selectedAnswerIds: answersToSubmit,
        }),
        keepalive: true,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit answer.');
      }
      lastSubmitRef.current = {
        questionId: activeQuestion.id,
        selected: answersToSubmit,
        isCorrect: Boolean(data.isCorrect),
        pointsAwarded: typeof data.pointsAwarded === 'number' ? data.pointsAwarded : 0,
      };
    } catch (err: unknown) {
      console.error(err);
      lastSubmitRef.current = null;
      setSubmissionState('idle');
      toast.error(err instanceof Error ? err.message : 'Failed to submit — tap again.');
    }
  };

  // Quick submit for MCQ & True/False (1 click)
  const handleChoiceTap = (choiceId: string) => {
    if (activeQuestion?.type === 'mcq' || activeQuestion?.type === 'true_false' || activeQuestion?.type === 'poll') {
      setSelectedAnswerIds([choiceId]);
      submitAnswer([choiceId]);
    }
  };

  // Toggle selection for Multi-select
  const handleCheckboxToggle = (choiceId: string) => {
    if (selectedAnswerIds.includes(choiceId)) {
      setSelectedAnswerIds(selectedAnswerIds.filter((id) => id !== choiceId));
    } else {
      setSelectedAnswerIds([...selectedAnswerIds, choiceId]);
    }
  };

  // Trigger Multi-select submit
  const handleMultiSubmit = () => {
    if (selectedAnswerIds.length === 0) {
      toast.error('Please select at least one choice.');
      return;
    }
    submitAnswer(selectedAnswerIds);
  };

  // Trigger text type-in submit
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeInputValue.trim()) {
      toast.error('Please type an answer before submitting.');
      return;
    }
    submitAnswer([typeInputValue.trim()]);
  };

  if (loading || !player) {
    return (
      <div className="min-h-screen bg-arena-stage flex flex-col items-center justify-center p-6 text-white font-sans">
        <Loader2 className="w-10 h-10 text-arena-acid animate-spin mb-4" />
        <p className="text-sm font-semibold text-white/60">Verifying session token...</p>
      </div>
    );
  }

  // ==========================================
  // RENDER: LOBBY STATE (WAITING SCREEN)
  // ==========================================
  if (sessionStatus === 'lobby') {
    return (
      <div className="arena-stage relative flex min-h-screen flex-col items-center justify-between overflow-hidden p-6 font-sans" style={customStyles}>
        <div className="pointer-events-none absolute inset-0 arena-grid opacity-15" />
        <div className="pointer-events-none absolute right-4 top-24 h-16 w-16 rotate-12 bg-arena-acid" />

        <header className="relative z-10 py-4">
          <BrandMark tone="light" size="sm" />
        </header>

        <main className="relative z-10 my-auto flex w-full max-w-sm flex-col items-center gap-6 text-center">
          <div className="w-full rounded-2xl border border-white/15 bg-white p-6 text-arena-ink shadow-[0_20px_50px_-24px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex justify-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  online ? 'bg-arena-court/15 text-arena-court' : 'bg-arena-signal/15 text-arena-signal'
                }`}
              >
                {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {online ? 'Connected' : 'Offline'}
              </span>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/40">You are in</p>
            <h1 className="mt-1 truncate font-display text-3xl font-extrabold text-arena-ink">{player.nickname}</h1>
            {player.team_name && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-arena-mist px-2.5 py-1 text-xs font-bold text-arena-court">
                <Users className="h-3.5 w-3.5" /> {player.team_name}
              </p>
            )}

            <div className="mt-6 border-t border-arena-line pt-5">
              <div className="mx-auto mb-3 h-1.5 w-24 overflow-hidden rounded-full bg-arena-mist">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-arena-signal" />
              </div>
              <p className="font-display text-sm font-bold text-arena-ink">Waiting for host…</p>
              <p className="mt-1 text-xs text-arena-ink/50">Watch the big screen — the round starts there.</p>
            </div>
          </div>
        </main>

        <footer className="relative z-10 py-4 text-[10px] text-white/40">Qlash</footer>
      </div>
    );
  }


  // ==========================================
  // RENDER: ROUND REVEAL RESULTS (CORRECT / INCORRECT STATE)
  // ==========================================
  if (roundResult && activeQuestion) {
    const isCorrect = roundResult.isCorrect;
    const points = roundResult.pointsAwarded;

    return (
      <div
        className={`min-h-screen w-full flex flex-col justify-between items-center p-6 text-center text-white font-sans transition-colors duration-500 ${
          isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
        }`}
      >
        <div />

        <div className="space-y-4 animate-scale-in w-full max-w-sm">
          <div className="flex justify-center">
            {isCorrect ? (
              <CheckCircle className="w-20 h-20 text-white fill-emerald-500" />
            ) : (
              <XCircle className="w-20 h-20 text-white fill-rose-500" />
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight">
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </h1>
          <p className="text-white/80 font-bold text-xl">
            {isCorrect ? `+${points.toLocaleString()} Points` : '+0 Points'}
          </p>
          {player.streak > 1 && isCorrect && (
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/20 border border-white/10 rounded-full text-sm font-extrabold animate-bounce">
              <Flame className="w-4 h-4 fill-current text-amber-300" />
              <span>Streak: {player.streak} answers!</span>
            </div>
          )}
        </div>

        {/* Choices Distribution Chart */}
        {(() => {
          const totalVotes = roundResult.optionCounts
            ? Object.values(roundResult.optionCounts).reduce((a, b) => a + b, 0)
            : 0;

          return roundResult.optionCounts ? (
            <div className="w-full max-w-sm bg-black/25 border border-white/10 rounded-3xl p-5 flex flex-col items-center gap-4 backdrop-blur-md my-2 animate-fade-in">
              <h3 className="text-[10px] uppercase font-black tracking-wider text-white/55">
                Answer Choices Distribution
              </h3>

              <div className="flex items-end justify-center gap-3.5 h-36 w-full px-2 border-b border-white/10 pb-1">
                {activeQuestion.answers.map((ans) => {
                  const votes = roundResult.optionCounts ? (roundResult.optionCounts[ans.id] || 0) : 0;
                  const ratio = totalVotes > 0 ? votes / totalVotes : 0;
                  const heightPercent = `${Math.max(8, ratio * 85)}%`;

                  const isCorrectOption = roundResult.correctAnswerIds.includes(ans.id);

                  return (
                    <div key={ans.id} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end select-none">
                      <span className="font-mono text-[10px] font-black text-white bg-arena-stage/80 px-1.5 py-0.5 rounded border border-white/5">
                        {votes}
                      </span>
                      <div
                        className="w-full rounded-t-lg transition-all duration-500 shadow-lg relative flex items-center justify-center"
                        style={{
                          height: heightPercent,
                          backgroundColor: ans.color,
                        }}
                      >
                        {isCorrectOption && (
                          <Check className="w-3.5 h-3.5 text-white bg-emerald-500 rounded-full border border-white absolute top-[-7px] flex items-center justify-center shrink-0" />
                        )}
                      </div>
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0"
                        style={{ backgroundColor: ans.color }}
                      >
                        {shapesMap[ans.shape] || '■'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}

        {/* Answer Breakdown comparison card */}
        <div className="w-full max-w-sm bg-black/25 border border-white/10 rounded-3xl p-5 space-y-4 text-left backdrop-blur-md my-4 animate-fade-in">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-white/50 border-b border-white/10 pb-2">
            Round Summary
          </h3>
          
          <div className="space-y-1">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block">
              Your Choice
            </span>
            {selectedAnswerIds.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {activeQuestion.answers
                  .filter((ans) => selectedAnswerIds.includes(ans.id))
                  .map((ans) => (
                    <div
                      key={ans.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-white border border-white/10"
                      style={{ backgroundColor: ans.color }}
                    >
                      <span className="shrink-0">{shapesMap[ans.shape] || '■'}</span>
                      <span className="truncate max-w-[200px]">{ans.text}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-rose-300 mt-0.5">
                <Clock className="w-3.5 h-3.5 inline-block mr-0.5" /> Time Out (No answer submitted)
              </p>
            )}
          </div>

          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block">
              Correct Answer
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {activeQuestion.answers
                .filter((ans) => roundResult.correctAnswerIds.includes(ans.id))
                .map((ans) => (
                  <div
                    key={ans.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-white border border-white/10"
                    style={{ backgroundColor: ans.color }}
                  >
                    <span className="shrink-0">{shapesMap[ans.shape] || '■'}</span>
                    <span className="truncate max-w-[200px]">{ans.text}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="w-full max-w-xs bg-black/20 border border-white/10 p-4 rounded-2xl mb-8">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest block">
            Total Score
          </span>
          <span className="text-2xl font-black font-mono mt-0.5 block">
            {player.score.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LEADERBOARD WAIT STATE
  // ==========================================
  if (sessionStatus === 'leaderboard') {
    return (
      <div className="min-h-screen bg-arena-stage flex flex-col items-center justify-center p-6 text-center text-white font-sans" style={customStyles}>
        <Award className="w-12 h-12 text-arena-acid animate-bounce mb-4" />
        <h1 className="text-2xl font-black">Scoreboard Time!</h1>
        <p className="text-white/60 text-sm max-w-xs mt-2 leading-relaxed">
          Look at the main presenter screen to check the current standings and see if you made it to the top!
        </p>
        <div className="w-full max-w-xs bg-white/10 border border-white/15 p-4 rounded-2xl mt-8">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest block">
            Your Current Score
          </span>
          <span className="text-2xl font-black font-mono text-arena-acid mt-0.5 block">
            {player.score.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: FINISHED STATE (GAME OVER RANK REVEAL)
  // ==========================================
  if (sessionStatus === 'finished') {
    const sortedPodium = [...podiumPlayers].sort((a, b) => b.score - a.score).slice(0, 3);
    const firstPlace = sortedPodium[0];
    const secondPlace = sortedPodium[1];
    const thirdPlace = sortedPodium[2];
    const teamRows = teamMode ? aggregateTeamScores(podiumPlayers) : [];
    const myTeamRank = player?.team_name
      ? teamRows.findIndex((t) => t.team_name === player.team_name) + 1
      : null;

    return (
      <div className="relative min-h-screen bg-arena-stage flex flex-col justify-between items-center p-6 text-center text-white font-sans overflow-hidden" style={customStyles}>
        {/* Glow */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-transparent blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-transparent blur-[150px] pointer-events-none" />

        <div className="flex items-center justify-between gap-4 z-10 w-full max-w-md mt-2">
          <span className="text-[10px] font-black bg-amber-600 px-2.5 py-1.5 rounded-lg uppercase tracking-wider text-white">
            Final Standings
          </span>
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500 animate-bounce" />
            <span className="text-white/60 font-bold text-xs">Game Over</span>
          </div>
        </div>

        <div className="my-2 text-center z-10">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-arena-acid to-white tracking-tight leading-none">
            Qlash Podium
          </h1>
          <p className="text-white/50 text-[10px] mt-1.5">
            Celebrating the game champions!
          </p>
        </div>

        {/* 3D Podium Layout */}
        <div className="flex-1 max-w-md mx-auto w-full flex items-end justify-center gap-2 sm:gap-4 z-10 py-6">
          {/* 2nd Place Block (Left) */}
          {secondPlace && (
            <div className="flex flex-col items-center gap-2 w-1/4 min-w-[70px] animate-scale-in">
              <div className="text-center w-full min-w-0">
                <span className="font-display text-sm font-bold text-white/50">2nd</span>
                <h3 className="font-extrabold text-[11px] sm:text-xs text-white truncate w-full mt-0.5">
                  {secondPlace.nickname}
                </h3>
                <span className="font-mono text-[10px] text-arena-acid font-bold">
                  {secondPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/10 border-x border-t border-white/15 rounded-t-2xl w-full h-24 flex flex-col items-center justify-center shadow-xl">
                <span className="font-black text-2xl text-white/50">2</span>
              </div>
            </div>
          )}

          {/* 1st Place Block (Center - Highest) */}
          {firstPlace && (
            <div className="flex flex-col items-center gap-2 w-1/3 min-w-[90px] z-10 animate-scale-in">
              <div className="text-center w-full min-w-0 flex flex-col items-center">
                <Trophy className="w-6 h-6 text-amber-400 fill-amber-400 animate-pulse" />
                <h3 className="font-black text-xs sm:text-sm text-white truncate w-full mt-0.5">
                  {firstPlace.nickname}
                </h3>
                <span className="font-mono text-xs text-arena-acid font-bold">
                  {firstPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/10/90 border-x border-t border-white/25/60 rounded-t-2xl w-full h-32 flex flex-col items-center justify-center shadow-2xl relative">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 rounded-t-full" />
                <span className="font-black text-3xl text-amber-500">1</span>
              </div>
            </div>
          )}

          {/* 3rd Place Block (Right) */}
          {thirdPlace && (
            <div className="flex flex-col items-center gap-2 w-1/4 min-w-[70px] animate-scale-in">
              <div className="text-center w-full min-w-0">
                <span className="font-display text-sm font-bold text-white/50">3rd</span>
                <h3 className="font-extrabold text-[11px] sm:text-xs text-white truncate w-full mt-0.5">
                  {thirdPlace.nickname}
                </h3>
                <span className="font-mono text-[10px] text-arena-acid font-bold">
                  {thirdPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/10 border-x border-t border-white/15 rounded-t-2xl w-full h-16 flex flex-col items-center justify-center shadow-xl">
                <span className="font-black text-2xl text-amber-700">3</span>
              </div>
            </div>
          )}
        </div>

        {/* Player Stats Block */}
        <div className="w-full max-w-xs bg-white/5 border border-white/15 p-4 rounded-2xl mb-4 z-10 space-y-3">
          <div className="flex justify-between items-center border-b border-white/15 pb-2">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              Your Performance
            </span>
            <span className="text-xs font-black text-arena-acid">
              #{finalRank ?? '-'} Rank
            </span>
          </div>
          {teamMode && player?.team_name && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">Team ({player.team_name})</span>
              <span className="text-sm font-bold text-fuchsia-300">
                #{myTeamRank || '-'} · {teamRows.find((t) => t.team_name === player.team_name)?.score ?? 0} pts
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/60">Final Points</span>
            <span className="text-lg font-black font-mono text-white">
              {player.score.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/60">Answer Streak</span>
            <span className="text-sm font-bold text-amber-400 flex items-center gap-0.5">
              <Flame className="w-4 h-4 fill-amber-400" /> {player.streak}
            </span>
          </div>
          {teamMode && teamRows.length > 0 && (
            <div className="pt-2 border-t border-white/15 space-y-1.5">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                Team Standings
              </span>
              {teamRows.slice(0, 5).map((team, idx) => (
                <div key={team.team_name} className="flex justify-between text-xs">
                  <span className={team.team_name === player?.team_name ? 'text-fuchsia-300 font-bold' : 'text-white/60'}>
                    #{idx + 1} {team.team_name}
                  </span>
                  <span className="font-mono text-white/80">{team.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={() => {
            localStorage.removeItem(`quizarena_token_${sessionId}`);
            router.push('/play');
          }}
          className="bg-white/10 hover:bg-slate-800 border border-white/15 font-bold rounded-xl text-xs h-11 px-6 w-full max-w-xs mb-6 z-10"
        >
          Return to Arena Joiner
        </Button>
      </div>
    );
  }

  // ==========================================
  // RENDER: ACTIVE QUESTION INTERFACES (INPUT MODES)
  // ==========================================
  if ((sessionStatus === 'question_active' || sessionStatus === 'question_paused') && activeQuestion) {
    // 1. SUBMITTED VIEW
    if (submissionState === 'submitted') {
      return (
        <div className="arena-stage flex min-h-screen flex-col items-center justify-center p-6 text-center font-sans">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-arena-acid font-display text-2xl font-extrabold text-arena-ink motion-pulse-soft">
            ✓
          </div>
          <h1 className="font-display text-3xl font-extrabold text-white">Answer locked</h1>
          {timeLeft > 0 && (
            <div className="mt-6 flex justify-center">
              <div
                className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-4 bg-white/5 transition-all duration-300 ${
                  timeLeft <= 5 ? 'scale-105 border-arena-signal' : 'border-arena-acid/60'
                }`}
              >
                <span
                  className={`font-display text-3xl font-extrabold tabular-nums ${
                    timeLeft <= 5 ? 'text-arena-signal' : 'text-white'
                  }`}
                >
                  {timeLeft}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/45">sec</span>
              </div>
            </div>
          )}
          <p className="mt-6 max-w-xs text-sm text-white/55">
            Waiting for the room — results hit when the host reveals.
          </p>
        </div>
      );
    }

    // 2. SUBMITTING INTERMEDIATE VIEW
    if (submissionState === 'submitting') {
      return (
        <div className="min-h-screen bg-arena-stage flex flex-col items-center justify-center p-6 text-center text-white font-sans">
          <Loader2 className="w-10 h-10 text-arena-acid animate-spin mb-4" />
          <p className="text-sm font-semibold text-white/60">Grading answer...</p>
        </div>
      );
    }

    // 3. INPUT FORM RENDER BASED ON QUESTION TYPE
    return (
      <div className="relative min-h-screen bg-arena-stage text-white flex flex-col justify-between p-4 font-sans" style={customStyles}>
        {sessionStatus === 'question_paused' && (
          <div className="absolute inset-0 bg-arena-stage/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-50 animate-fade-in">
            <Pause className="w-12 h-12 text-amber-500 animate-pulse mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">Game is Paused</h2>
            <p className="text-white/60 text-xs max-w-xs">
              The host has paused the round timer. Hold on, submissions will resume shortly!
            </p>
          </div>
        )}
        {/* Header summary */}
        <div className="flex items-center justify-between text-xs text-white/50 font-semibold border-b border-white/10 pb-3">
          <span>PIN: {sessionId}</span>
          <span className="uppercase tracking-widest text-arena-acid font-bold">
            {player.team_name ? <><Users className="w-3 h-3 inline-block mr-0.5" /> {player.team_name}</> : activeQuestion.type.replace('_', ' ')}
          </span>
          <span>Score: {player.score}</span>
        </div>

        {/* Input Interface Area */}
        <main className="flex-1 flex flex-col items-center justify-center py-6 w-full max-w-md mx-auto">
          {/* Question Prompt & Timer */}
          <div className="text-center space-y-4 mb-6 max-w-sm flex flex-col items-center">
            {activeMultiplier > 1 && (
              <div className="px-3 py-1.5 rounded-lg bg-amber-500 text-arena-ink text-xs font-black uppercase tracking-wider animate-pulse flex items-center gap-1 mb-1">
                <Zap className="w-3.5 h-3.5" /> {activeMultiplier}x Points Active
              </div>
            )}
            
            {timeLeft > 0 && (
              <div className="flex justify-center my-2">
                <div
                  className={`relative flex h-24 w-24 flex-col items-center justify-center border-4 bg-white/5 transition-all duration-300 ${
                    timeLeft <= 5
                      ? 'scale-105 border-arena-signal motion-pulse-soft'
                      : 'border-arena-acid'
                  }`}
                >
                  <span
                    className={`font-display text-3xl font-extrabold tabular-nums ${
                      timeLeft <= 5 ? 'text-arena-signal' : 'text-white'
                    }`}
                  >
                    {timeLeft}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/45">sec</span>
                </div>
              </div>
            )}

            <h2 className="text-xl font-extrabold text-white leading-snug tracking-tight">
              {activeQuestion.prompt}
            </h2>
          </div>

          {activeQuestion.type === 'type_answer' ? (
            // TYPE ANSWER MODE
            <form onSubmit={handleTextSubmit} className="w-full space-y-4 bg-white/5 p-6 border border-white/15 rounded-3xl shadow-xl">
              <div className="text-center space-y-1 mb-4">
                <h2 className="text-xs uppercase font-extrabold text-white/50 tracking-wider">
                  Type Your Answer
                </h2>
                <p className="text-white/60 text-xs">
                  Fuzzy case-insensitive matching is active.
                </p>
              </div>

              <Input
                placeholder="Type here..."
                value={typeInputValue}
                onChange={(e) => setTypeInputValue(e.target.value)}
                className="bg-arena-stage border-white/15 h-14 text-center text-lg font-bold focus-visible:ring-arena-court rounded-xl"
                maxLength={40}
                required
              />

              <Button
                type="submit"
                className="w-full bg-arena-signal hover:bg-arena-signal/90 text-white font-bold h-12 rounded-xl text-base shadow-lg"
              >
                Submit Answer
              </Button>
            </form>
          ) : activeQuestion.type === 'multi_select' ? (
            // MULTI-SELECT CHECKBOX GRID MODE
            <div className="w-full space-y-6">
              <div className="text-center space-y-1 mb-2">
                <h2 className="text-xs uppercase font-extrabold text-arena-acid tracking-wider">
                  Select Multiple Answers
                </h2>
                <p className="text-white/50 text-xs">
                  Pick all options you believe are correct, then tap Submit.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                {activeQuestion.answers.map((ans) => {
                  const isChecked = selectedAnswerIds.includes(ans.id);
                  return (
                    <AnswerButton
                      key={ans.id}
                      color={ans.color}
                      shape={ans.shape}
                      label={ans.text}
                      selected={isChecked}
                      onClick={() => handleCheckboxToggle(ans.id)}
                      className="min-h-[9rem]"
                    />
                  );
                })}
              </div>

              <Button
                onClick={handleMultiSubmit}
                className="w-full bg-gradient-to-r from-arena-signal to-[#c21828] hover:brightness-110 text-white font-bold h-12 rounded-xl text-base shadow-lg"
              >
                Submit Choices
              </Button>
            </div>
          ) : (
            // MCQ / TRUE-FALSE / POLL SINGLE CLICK BUTTONS GRID
            <div className="grid grid-cols-2 gap-3 w-full">
              {activeQuestion.answers.map((ans) => (
                <AnswerButton
                  key={ans.id}
                  color={ans.color}
                  shape={ans.shape}
                  label={ans.text}
                  onClick={() => handleChoiceTap(ans.id)}
                  className="min-h-[9.5rem]"
                />
              ))}
            </div>
          )}
        </main>

        {/* Footer timing indicator */}
        <div className="flex justify-center items-center gap-1.5 py-4 border-t border-white/10 text-white/50 text-xs font-semibold text-center">
          <Clock className="w-4 h-4 text-white/50" />
          <span>Timer is ticking! Answer quickly for a speed bonus.</span>
        </div>
      </div>
    );
  }

  // Fallback Loading screen
  return (
    <div className="min-h-screen bg-arena-stage flex flex-col items-center justify-center p-6 text-white font-sans">
      <Loader2 className="w-10 h-10 text-arena-acid animate-spin mb-4" />
      <p className="text-sm font-semibold text-white/60">Loading arena state...</p>
    </div>
  );
}
