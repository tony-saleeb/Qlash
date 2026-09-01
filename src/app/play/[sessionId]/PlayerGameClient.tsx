'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Flame, Wifi, WifiOff, Loader2, Award, CheckCircle, XCircle, Clock, Trophy, Pause, Check, Users, Zap, LogOut, Volume2, VolumeX } from 'lucide-react';
import { BrandMark, AnswerButton, LobbyWaitMarks } from '@/components/brand/BrandMark';
import { GameShell, LiveChip } from '@/components/brand/GameShell';
import { ClashCountdownOverlay } from '@/components/brand/ClashCountdown';
import { QLASH_CONFETTI } from '@/lib/game/theme';
import { AnswerSwatch } from '@/components/brand/AnswerMark';
import {
  bindAudioUnlock,
  playCorrectSound,
  playIncorrectSound,
  playFanfareSound,
  playJoinSound,
  playLockSound,
  playQuestionStartSound,
  playTickSound,
  playHaptic,
  unlockGameAudio,
  isGameAudioMuted,
  setGameAudioMuted,
} from '@/lib/sounds';
import confetti from 'canvas-confetti';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import {
  type Player,
  type PublicQuestionPayload,
} from '@/lib/game/types';
import { remainingFromPausedElapsed, remainingSeconds, startedAtFromRemaining } from '@/lib/game/clock';
import { answerUsesInk, resolveAnswerColor } from '@/lib/game/marks';
import { aggregateTeamScores } from '@/lib/game/teams';
import { playerJoinedAfterQuestionStart } from '@/lib/game/lateJoin';
import { canSendReaction, type LobbyReactionId } from '@/lib/game/reactions';
import { rankMove, rankOfPlayer } from '@/lib/game/rankMove';
import { roundCallout } from '@/lib/game/roundCallout';
import { LocaleToggle } from '@/components/brand/LocaleToggle';
import { useLocale } from '@/lib/i18n/useLocale';
import type { MessageKey } from '@/lib/i18n/messages';

type ActiveQuestionPayload = PublicQuestionPayload;

const LOBBY_WAIT_TIPS: MessageKey[] = [
  'watchBigScreen',
  'lobbyTipBoard',
  'lobbyTipFast',
  'lobbyTipColors',
];

const LOCK_WAIT_TIPS: MessageKey[] = [
  'lockTipWatch',
  'lockTipCheer',
  'lockTipHold',
];

interface PlayerGameClientProps {
  sessionId: string;
  initialSessionStatus: string;
  teamMode?: boolean;
}

export default function PlayerGameClient({
  sessionId,
  initialSessionStatus,
  teamMode = false,
}: PlayerGameClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { locale, setLocale, t } = useLocale();

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
  const [lobbyTipIndex, setLobbyTipIndex] = useState(0);
  const [clashPlay, setClashPlay] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => isGameAudioMuted());
  const [liveRank, setLiveRank] = useState<number | null>(null);
  const [lockTipIndex, setLockTipIndex] = useState(0);

  const playerRef = React.useRef<Player | null>(null);
  const activeQuestionRef = React.useRef<ActiveQuestionPayload | null>(null);
  const lastSubmitRef = React.useRef<{
    questionId: string;
    selected: string[];
    isCorrect: boolean | null;
    pointsAwarded: number;
  } | null>(null);
  const revealAppliedRef = React.useRef<string | null>(null);
  const lastTickSecondRef = React.useRef<number | null>(null);
  const displayedSecondRef = React.useRef<number | null>(null);
  const lobbyFanfarePlayedRef = React.useRef(false);
  const clockStartedAtRef = React.useRef<string | null>(null);
  const sawOpenQuestionRef = React.useRef(false);
  const lastReactionAtRef = React.useRef(0);
  const lockedRemainingRef = React.useRef<number | null>(null);
  const liveRankRef = React.useRef<number | null>(null);
  const previousRankRef = React.useRef<number | null>(null);
  const previousStreakRef = React.useRef(0);
  liveRankRef.current = liveRank;

  React.useEffect(() => bindAudioUnlock(), []);

  React.useEffect(() => {
    if (!player || sessionStatus !== 'lobby' || lobbyFanfarePlayedRef.current) return;
    lobbyFanfarePlayedRef.current = true;
    playJoinSound();
    playHaptic(20);
  }, [player, sessionStatus]);

  React.useEffect(() => {
    if (sessionStatus !== 'lobby') return;
    const id = window.setInterval(() => {
      setLobbyTipIndex((i) => (i + 1) % LOBBY_WAIT_TIPS.length);
    }, 3400);
    return () => window.clearInterval(id);
  }, [sessionStatus]);

  React.useEffect(() => {
    if (submissionState !== 'submitted') return;
    const id = window.setInterval(() => {
      setLockTipIndex((i) => (i + 1) % LOCK_WAIT_TIPS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [submissionState]);

  React.useEffect(() => {
    if (sessionStatus !== 'leaderboard' || !player?.id) return;
    let cancelled = false;
    void supabase
      .from('players')
      .select('id')
      .eq('session_id', sessionId)
      .order('score', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const rank = data.findIndex((row) => row.id === player.id) + 1;
        setLiveRank(rank > 0 ? rank : null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, player?.id, sessionId, supabase]);

  React.useEffect(() => {
    playerRef.current = player;
  }, [player]);

  React.useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

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
        clockStartedAtRef.current = serverStartedAt;
        setTimeLeft(remainingSeconds(serverStartedAt, question.time_limit_seconds));
      } else {
        setClockStartedAt(null);
        clockStartedAtRef.current = null;
        setTimeLeft(question.time_limit_seconds);
      }

      setSelectedAnswerIds([]);
      setTypeInputValue('');
      setSubmissionState('idle');
      setRoundResult(null);
      sawOpenQuestionRef.current =
        status !== 'question_reveal' && status !== 'leaderboard' && status !== 'finished';
      previousRankRef.current = liveRankRef.current;
      previousStreakRef.current = playerRef.current?.streak ?? 0;
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
          const current = activeQuestionRef.current;
          if (current?.id === data.question.id) {
            if (data.server_started_at && data.question.time_limit_seconds) {
              setClockStartedAt(data.server_started_at);
              clockStartedAtRef.current = data.server_started_at;
              setTimeLeft(remainingSeconds(data.server_started_at, data.question.time_limit_seconds));
            }
          } else {
            applyQuestionPayload(data.question, data.server_started_at, data.status);
          }
          if (data.status === 'question_reveal') {
            const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
            const resResult = await fetch('/api/player/round-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                playerId,
                token,
                questionId: data.question.id,
              }),
            });
            const round = await resResult.json();
            if (resResult.ok) {
              if (round.player) {
                setPlayer((prev) =>
                  prev
                    ? { ...prev, score: round.player.score ?? prev.score, streak: round.player.streak ?? prev.streak }
                    : prev
                );
              }
              const joinedLate = playerJoinedAfterQuestionStart(
                playerRef.current?.joined_at,
                data.server_started_at
              );
              if (round.hadSubmission && round.submission) {
                setRoundResult({
                  isCorrect: Boolean(round.submission.is_correct),
                  pointsAwarded: Number(round.submission.points_awarded) || 0,
                  correctAnswerIds: [],
                  optionCounts: undefined,
                });
              } else if (!joinedLate) {
                setRoundResult({
                  isCorrect: false,
                  pointsAwarded: 0,
                  correctAnswerIds: [],
                  optionCounts: undefined,
                });
              }
            }
          }
          return;
        }
      } catch (err) {
        console.error('Failed to hydrate current question', err);
      }
    },
    [sessionId, applyQuestionPayload]
  );

  const loadPodium = useCallback(
    async (playerId: string) => {
      const { data: allPlayers } = await supabase
        .from('players')
        .select('id, nickname, score')
        .eq('session_id', sessionId)
        .order('score', { ascending: false });

      if (allPlayers) {
        setFinalRank(allPlayers.findIndex((row) => row.id === playerId) + 1);
        setPodiumPlayers(allPlayers as Player[]);
      }
    },
    [supabase, sessionId]
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
        const { data: rows } = await supabase
          .from('players')
          .select('id, score')
          .eq('session_id', sessionId);
        if (rows) setLiveRank(rankOfPlayer(rows, playerId));
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
    [sessionId, supabase]
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
        submit && submit.questionId === currentQ?.id ? submit.selected : [];
      const playedThisRound = Boolean(submit && submit.questionId === currentQ?.id);

      if (!playedThisRound && !sawOpenQuestionRef.current) {
        setRoundResult(null);
        setSessionStatus('question_reveal');
        setSubmissionState('idle');
        return;
      }

      let isCorrect = false;
      let pointsAwarded = 0;
      if (submit && submit.questionId === currentQ?.id && submit.isCorrect !== null) {
        isCorrect = submit.isCorrect;
        pointsAwarded = submit.pointsAwarded;
      } else if (currentQ?.type !== 'poll' && selected.length > 0) {
        const sel = [...selected].sort();
        const cor = [...correctAnswerIds].sort();
        isCorrect = sel.length === cor.length && sel.every((id, i) => id === cor[i]);
      }

      const callout = roundCallout({
        isCorrect,
        isPoll: currentQ?.type === 'poll',
        lockedRemaining: lockedRemainingRef.current,
        timeLimit: currentQ?.time_limit_seconds ?? 0,
        previousStreak: previousStreakRef.current,
      });

      if (isCorrect) {
        playCorrectSound();
        playHaptic(callout === 'clutch' ? [24, 40, 24] : callout === 'lightning' ? [16, 30, 16] : 24);
      } else {
        playIncorrectSound();
        playHaptic(8);
      }

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

  const { send: sendSessionEvent } = useSessionChannel(sessionId, {
    supabase,
    onEvents: {
      'clash:countdown': () => {
        setClashPlay(true);
      },
      'question:start': (msg) => {
        const payload = msg.payload;
        const questionId = payload.question_id as string | undefined;
        if (!questionId) return;
        setClashPlay(false);
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
        playQuestionStartSound();
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
        playerRef.current = data.player as Player;
        if (data.sessionStatus) setSessionStatus(data.sessionStatus);
        setLoading(false);

        const status = data.sessionStatus as string | undefined;
        if (
          status === 'question_active' ||
          status === 'question_paused' ||
          status === 'question_reveal' ||
          status === 'leaderboard'
        ) {
          void hydrateCurrentQuestion(data.player.id);
        } else if (status === 'finished') {
          void loadPodium(data.player.id);
        }
      } catch (err) {
        console.error('Authentication error:', err);
        router.push('/play');
      }
    };

    authenticatePlayer();
  }, [sessionId, router, hydrateCurrentQuestion, loadPodium]);

  useEffect(() => {
    if (!player?.id) return;

    const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
    const playerId = player.id;
    let revealFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let connectionTimer: ReturnType<typeof setTimeout> | null = null;

    const liveChannel = supabase
      .channel(`player_live_${playerId}`)
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
                clockStartedAtRef.current = startedAt;
                setTimeLeft(remainingSeconds(startedAt, limit));
              }
            }
          } else if (newStatus === 'question_reveal') {
            const q = activeQuestionRef.current;
            revealFallbackTimer = setTimeout(() => {
              if (q && revealAppliedRef.current !== q.id) {
                applyRevealInstant([]);
              }
            }, 250);
          } else if (newStatus === 'leaderboard') {
            setRoundResult(null);
          } else if (newStatus === 'finished') {
            if (!activeQuestionRef.current) {
              localStorage.removeItem(`quizarena_token_${sessionId}`);
              toast.info(t('lobbyClosed'));
              router.push('/play');
              return;
            }
            void loadPodium(playerId);
          }
        }
      )
      .subscribe();

    const syncConnection = (connected: boolean) => {
      void fetch('/api/player/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, token, connected }),
        keepalive: true,
      });
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setOnline(isVisible);
      if (connectionTimer) clearTimeout(connectionTimer);
      connectionTimer = setTimeout(() => {
        syncConnection(isVisible);
        if (isVisible) void hydrateCurrentQuestion(playerId);
      }, 400);
    };

    const handlePageHide = () => {
      syncConnection(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      if (connectionTimer) clearTimeout(connectionTimer);
      if (revealFallbackTimer) clearTimeout(revealFallbackTimer);
      supabase.removeChannel(liveChannel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [supabase, player?.id, sessionId, router, hydrateCurrentQuestion, applyRevealInstant, loadPodium, t]);

  useEffect(() => {
    if (sessionStatus !== 'question_active' || !activeQuestion || !clockStartedAt) return;

    const limit = activeQuestion.time_limit_seconds;
    const started = new Date(clockStartedAt).getTime();
    if (!Number.isFinite(started) || !limit) return;

    displayedSecondRef.current = null;
    lastTickSecondRef.current = null;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil(limit - (Date.now() - started) / 1000));
      if (remaining !== displayedSecondRef.current) {
        displayedSecondRef.current = remaining;
        setTimeLeft(remaining);
      }
      if (remaining <= 5 && remaining > 0 && remaining !== lastTickSecondRef.current) {
        lastTickSecondRef.current = remaining;
        playTickSound();
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [sessionStatus, activeQuestion?.id, activeQuestion?.time_limit_seconds, clockStartedAt]);

  useEffect(() => {
    if (sessionStatus !== 'finished') return;
    playFanfareSound();
    const duration = 5 * 1000;
    const end = Date.now() + duration;
    let raf = 0;
    let cancelled = false;

    const frame = () => {
      if (cancelled) return;
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: [...QLASH_CONFETTI],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: [...QLASH_CONFETTI],
      });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [sessionStatus]);

  const handleLeaveLobby = async () => {
    if (!player) return;
    const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
    try {
      await fetch('/api/player/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, playerId: player.id, token }),
      });
    } catch {
      // Still leave the screen even if the request fails.
    }
    localStorage.removeItem(`quizarena_token_${sessionId}`);
    router.push('/play');
  };

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setGameAudioMuted(next);
    if (!next) void unlockGameAudio();
  };

  const sendLobbyReaction = (mark: LobbyReactionId) => {
    if (!player) return;
    void unlockGameAudio();
    const now = Date.now();
    if (!canSendReaction(lastReactionAtRef.current, now)) return;
    lastReactionAtRef.current = now;
    playHaptic(12);
    void sendSessionEvent('lobby:react', {
      mark,
      nickname: player.nickname,
      playerId: player.id,
    });
  };

  // Instant lock-in UX — never wait on the network to feel responsive
  const submitAnswer = async (answersToSubmit: string[]) => {
    if (!player || !activeQuestion || submissionState !== 'idle') return;
    void unlockGameAudio();
    playLockSound();

    const token = localStorage.getItem(`quizarena_token_${sessionId}`) || '';
    setSelectedAnswerIds(answersToSubmit);
    setSubmissionState('submitted');
    lastSubmitRef.current = {
      questionId: activeQuestion.id,
      selected: answersToSubmit,
      isCorrect: null,
      pointsAwarded: 0,
    };
    lockedRemainingRef.current = timeLeft;
    playHaptic(16);

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
      if (!data.duplicate || data.isCorrect === true || (typeof data.pointsAwarded === 'number' && data.pointsAwarded > 0)) {
        lastSubmitRef.current = {
          questionId: activeQuestion.id,
          selected: answersToSubmit,
          isCorrect: Boolean(data.isCorrect),
          pointsAwarded: typeof data.pointsAwarded === 'number' ? data.pointsAwarded : 0,
        };
      }
    } catch (err: unknown) {
      console.error(err);
      lastSubmitRef.current = null;
      setSubmissionState('idle');
      toast.error(err instanceof Error ? err.message : 'Failed to submit — tap again.');
    }
  };

  // Quick submit for MCQ & True/False (1 click)
  const handleChoiceTap = (choiceId: string) => {
    void unlockGameAudio();
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
      <GameShell className="items-center justify-center" padded>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-arena-acid" />
          <p className="text-sm font-semibold text-white/60">{t('lockingYouIn')}</p>
        </div>
      </GameShell>
    );
  }

  // ==========================================
  // RENDER: LOBBY STATE (WAITING SCREEN)
  // ==========================================
  if (sessionStatus === 'lobby') {
    return (
      <GameShell>
        <ClashCountdownOverlay play={clashPlay} clashWord={t('clash')} onDone={() => setClashPlay(false)} />
        <header className="flex items-center justify-between py-2">
          <BrandMark tone="light" size="sm" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              className="flex h-9 w-9 items-center justify-center border border-white/20 bg-white/10 text-white"
              aria-label={soundMuted ? t('soundOff') : t('soundOn')}
            >
              {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <LocaleToggle locale={locale} onChange={setLocale} tone="light" />
          </div>
        </header>

        <main className="my-auto flex w-full max-w-sm flex-col items-center gap-6 text-center">
          <div className="w-full border-2 border-arena-ink bg-white p-6 text-arena-ink shadow-[8px_8px_0_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex justify-center">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  online ? 'bg-arena-acid text-arena-ink' : 'bg-arena-signal text-white'
                }`}
              >
                {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {online ? t('connected') : t('offline')}
              </span>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-arena-ink/40">{t('youAreIn')}</p>
            <h1 dir="auto" className="mt-1 font-display text-4xl font-extrabold leading-none text-arena-ink sm:text-5xl">{player.nickname}</h1>
            {player.team_name && (
              <p className="mt-2 inline-flex items-center gap-1 bg-arena-mist px-2.5 py-1 text-xs font-bold text-arena-court">
                <Users className="h-3.5 w-3.5" /> {player.team_name}
              </p>
            )}

            <div className="mt-6 border-t-2 border-arena-ink/10 pt-5">
              <LobbyWaitMarks className="mb-3" onPick={sendLobbyReaction} />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-arena-ink/35">{t('tapToCheer')}</p>
              <p className="mt-3 font-display text-sm font-bold text-arena-ink">{t('waitingForHost')}</p>
              <p
                key={LOBBY_WAIT_TIPS[lobbyTipIndex]}
                className="mt-1 min-h-[2.6rem] text-xs leading-relaxed text-arena-ink/50 animate-fade-in"
              >
                {t(LOBBY_WAIT_TIPS[lobbyTipIndex])}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleLeaveLobby()}
                className="mt-4 h-10 w-full rounded-none text-xs font-bold uppercase tracking-wider text-arena-ink/45 hover:bg-arena-ink hover:text-white"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t('leaveLobby')}
              </Button>
            </div>
          </div>
        </main>

        <footer className="py-3 text-center font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
          Qlash
        </footer>
      </GameShell>
    );
  }


  // ==========================================
  // RENDER: ROUND REVEAL RESULTS (CORRECT / INCORRECT STATE)
  // ==========================================
  if (roundResult && activeQuestion) {
    const isCorrect = roundResult.isCorrect;
    const points = roundResult.pointsAwarded;
    const move = rankMove(previousRankRef.current, liveRank);
    const callout = roundCallout({
      isCorrect,
      isPoll: activeQuestion.type === 'poll',
      lockedRemaining: lockedRemainingRef.current,
      timeLimit: activeQuestion.time_limit_seconds,
      previousStreak: previousStreakRef.current,
    });

    return (
      <div
        className={`flex min-h-dvh w-full flex-col items-center justify-between p-6 text-center font-sans transition-colors duration-500 ${
          isCorrect ? 'bg-arena-acid text-arena-ink' : 'bg-arena-signal text-white'
        }`}
      >
        <div />

        <div className="w-full max-w-sm space-y-4 animate-scale-in">
          <div className="flex justify-center">
            {isCorrect ? (
              <CheckCircle className="h-20 w-20 text-arena-ink" />
            ) : (
              <XCircle className="h-20 w-20 text-white" />
            )}
          </div>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">
            {isCorrect ? t('correct') : t('missed')}
          </h1>
          <p className={`font-display text-xl font-bold ${isCorrect ? 'text-arena-ink/80' : 'text-white/85'}`}>
            {isCorrect ? `+${points.toLocaleString()} ${t('pointsWord')}` : `+0 ${t('pointsWord')}`}
          </p>
          {player.streak > 1 && isCorrect && (
            <div className="inline-flex animate-bounce items-center gap-1.5 border-2 border-arena-ink bg-white px-4 py-1.5 text-sm font-extrabold text-arena-ink">
              <Flame className="h-4 w-4 fill-current" />
              <span>{t('streakWord')}: {player.streak}</span>
            </div>
          )}
          {callout === 'clutch' && (
            <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-arena-ink/80">
              {t('clutch')}
            </p>
          )}
          {callout === 'lightning' && (
            <p className="inline-flex items-center gap-1 font-display text-sm font-black uppercase tracking-[0.18em] text-arena-ink/80">
              <Zap className="h-4 w-4" /> {t('lightning')}
            </p>
          )}
          {callout === 'streakBroken' && (
            <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-white/85">
              {t('streakBroken')}
            </p>
          )}
          {move ? (
            <p className={`font-display text-lg font-black ${isCorrect ? 'text-arena-ink' : 'text-white'}`}>
              {move.kind === 'up' ? `↑ ${move.delta} · ` : move.kind === 'down' ? `↓ ${Math.abs(move.delta)} · ` : ''}
              {t('yourRankPrefix')}{move.current}
            </p>
          ) : null}
        </div>

        {(() => {
          const totalVotes = roundResult.optionCounts
            ? Object.values(roundResult.optionCounts).reduce((a, b) => a + b, 0)
            : 0;

          return roundResult.optionCounts ? (
            <div className={`my-2 flex w-full max-w-sm flex-col items-center gap-4 border-2 p-5 animate-fade-in ${
              isCorrect ? 'border-arena-ink/20 bg-black/10' : 'border-white/20 bg-black/25'
            }`}>
              <h3 className={`text-[10px] font-black uppercase tracking-[0.18em] ${isCorrect ? 'text-arena-ink/55' : 'text-white/55'}`}>
                {t('howTheRoomVoted')}
              </h3>

              <div className={`flex h-36 w-full items-end justify-center gap-3.5 border-b px-2 pb-1 ${
                isCorrect ? 'border-arena-ink/20' : 'border-white/15'
              }`}>
                {activeQuestion.answers.map((ans) => {
                  const votes = roundResult.optionCounts ? (roundResult.optionCounts[ans.id] || 0) : 0;
                  const ratio = totalVotes > 0 ? votes / totalVotes : 0;
                  const heightPercent = `${Math.max(8, ratio * 85)}%`;

                  const isCorrectOption = roundResult.correctAnswerIds.includes(ans.id);

                  return (
                    <div key={ans.id} className="flex h-full flex-1 select-none flex-col items-center justify-end gap-1.5">
                      <span className="border border-white/10 bg-arena-stage/80 px-1.5 py-0.5 font-mono text-[10px] font-black text-white">
                        {votes}
                      </span>
                      <div
                        className="relative flex w-full items-center justify-center shadow-[3px_0_0_rgba(0,0,0,0.2)] transition-all duration-500"
                        style={{
                          height: heightPercent,
                          backgroundColor: resolveAnswerColor(ans.color),
                        }}
                      >
                        {isCorrectOption && (
                          <Check className="absolute top-[-7px] h-3.5 w-3.5 shrink-0 border border-arena-ink bg-arena-acid text-arena-ink" />
                        )}
                      </div>
                      <AnswerSwatch
                        shape={ans.shape}
                        color={ans.color}
                        className="h-6 w-6"
                        markClassName="h-3.5 w-3.5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}

        <div className={`my-4 w-full max-w-sm space-y-4 border-2 p-5 text-left animate-fade-in ${
          isCorrect ? 'border-arena-ink/20 bg-black/10' : 'border-white/20 bg-black/25'
        }`}>
          <h3 className={`border-b pb-2 text-xs font-extrabold uppercase tracking-wider ${
            isCorrect ? 'border-arena-ink/15 text-arena-ink/50' : 'border-white/10 text-white/50'
          }`}>
            {t('roundSummary')}
          </h3>
          
          <div className="space-y-1">
            <span className={`block text-[10px] font-black uppercase tracking-widest ${isCorrect ? 'text-arena-ink/40' : 'text-white/40'}`}>
              {t('yourChoice')}
            </span>
            {selectedAnswerIds.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {activeQuestion.answers
                  .filter((ans) => selectedAnswerIds.includes(ans.id))
                  .map((ans) => (
                    <div
                      key={ans.id}
                      className={`flex items-center gap-2 border-2 border-arena-ink px-3 py-1.5 text-xs font-bold ${
                        answerUsesInk(ans.color) ? 'text-arena-ink' : 'text-white'
                      }`}
                      style={{ backgroundColor: resolveAnswerColor(ans.color) }}
                    >
                      <AnswerSwatch
                        shape={ans.shape}
                        color={ans.color}
                        className="h-5 w-5"
                        markClassName="h-3 w-3"
                      />
                      <span dir="auto" className="max-w-[200px] truncate">{ans.text}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className={`mt-0.5 text-sm font-semibold ${isCorrect ? 'text-arena-ink' : 'text-white'}`}>
                <Clock className="mr-0.5 inline-block h-3.5 w-3.5" /> {t('timeOutNoAnswer')}
              </p>
            )}
          </div>

          <div className="space-y-1 pt-1">
            <span className={`block text-[10px] font-black uppercase tracking-widest ${isCorrect ? 'text-arena-ink/40' : 'text-white/40'}`}>
              {t('correctAnswer')}
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {activeQuestion.answers
                .filter((ans) => roundResult.correctAnswerIds.includes(ans.id))
                .map((ans) => (
                  <div
                    key={ans.id}
                    className={`flex items-center gap-2 border-2 border-arena-ink px-3 py-1.5 text-xs font-bold ${
                      answerUsesInk(ans.color) ? 'text-arena-ink' : 'text-white'
                    }`}
                    style={{ backgroundColor: resolveAnswerColor(ans.color) }}
                  >
                    <AnswerSwatch
                      shape={ans.shape}
                      color={ans.color}
                      className="h-5 w-5"
                      markClassName="h-3 w-3"
                    />
                    <span dir="auto" className="max-w-[200px] truncate">{ans.text}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className={`mb-8 w-full max-w-xs border-2 p-4 ${
          isCorrect ? 'border-arena-ink/25 bg-white/40' : 'border-white/20 bg-black/20'
        }`}>
          <span className={`block text-[10px] font-bold uppercase tracking-widest ${isCorrect ? 'text-arena-ink/50' : 'text-white/50'}`}>
            {t('totalScore')}
          </span>
          <span className="mt-0.5 block font-display text-2xl font-black tabular-nums">
            {player.score.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LATE JOIN DURING REVEAL / BETWEEN ROUNDS
  // ==========================================
  if (sessionStatus === 'question_reveal' && !roundResult) {
    return (
      <GameShell className="items-center justify-center">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <LiveChip tone="acid">{t('youAreIn')}</LiveChip>
          <h1 className="mt-4 font-display text-2xl font-extrabold text-white">{t('lateJoinNextRound')}</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">{t('watchBigScreen')}</p>
          <div className="mt-8 w-full max-w-xs border-2 border-white/15 bg-white/[0.06] p-4">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50">
              {t('scoreboardTime')}
            </span>
            <span className="mt-0.5 block font-display text-2xl font-black tabular-nums text-arena-acid">
              {player.score.toLocaleString()}
            </span>
          </div>
        </div>
      </GameShell>
    );
  }

  // ==========================================
  // RENDER: LEADERBOARD WAIT STATE
  // ==========================================
  if (sessionStatus === 'leaderboard') {
    return (
      <GameShell className="items-center justify-center">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Award className="mb-4 h-12 w-12 text-arena-acid" />
          <h1 className="font-display text-2xl font-extrabold text-white">{t('scoreboardTime')}</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">
            {t('lookAtProjector')}
          </p>
          {liveRank ? (
            <p className="mt-4 font-display text-4xl font-black text-arena-acid">
              {(() => {
                const move = rankMove(previousRankRef.current, liveRank);
                if (!move) return `${t('yourRankPrefix')}${liveRank}`;
                const arrow =
                  move.kind === 'up' ? `↑ ${move.delta} · ` : move.kind === 'down' ? `↓ ${Math.abs(move.delta)} · ` : '';
                return `${arrow}${t('yourRankPrefix')}${move.current}`;
              })()}
            </p>
          ) : null}
          <div className="mt-8 w-full max-w-xs border-2 border-white/15 bg-white/[0.06] p-4">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50">
              {t('yourScore')}
            </span>
            <span className="mt-0.5 block font-display text-2xl font-black tabular-nums text-arena-acid">
              {player.score.toLocaleString()}
            </span>
          </div>
        </div>
      </GameShell>
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
      <GameShell>
        <div className="mt-2 flex w-full max-w-md items-center justify-between gap-4">
          <LiveChip tone="acid">{t('finalStandings')}</LiveChip>
          <BrandMark tone="light" size="sm" wordmark={false} />
        </div>

        <div className="z-10 my-2 text-center">
          <h1 className="font-display text-3xl font-extrabold leading-none tracking-tight text-white">
            Qlash <span className="text-arena-acid">podium</span>
          </h1>
        </div>

        <div className="z-10 mx-auto flex w-full max-w-md flex-1 items-end justify-center gap-2 py-6 sm:gap-4">
          {secondPlace && (
            <div className="flex w-1/4 min-w-[70px] flex-col items-center gap-2 animate-scale-in">
              <div className="w-full min-w-0 text-center">
                <span className="font-display text-sm font-bold text-white/50">2nd</span>
                <h3 className="mt-0.5 w-full truncate text-[11px] font-extrabold text-white sm:text-xs">
                  {secondPlace.nickname}
                </h3>
                <span className="font-display text-[10px] font-bold tabular-nums text-arena-acid">
                  {secondPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="flex h-24 w-full flex-col items-center justify-center border-2 border-white/20 bg-[#4a2aff] shadow-[4px_4px_0_rgba(0,0,0,0.3)]">
                <span className="font-display text-2xl font-black text-white">2</span>
              </div>
            </div>
          )}

          {firstPlace && (
            <div className="z-10 flex w-1/3 min-w-[90px] flex-col items-center gap-2 animate-scale-in">
              <div className="flex w-full min-w-0 flex-col items-center text-center">
                <Trophy className="h-6 w-6 fill-arena-acid text-arena-acid" />
                <h3 className="mt-0.5 w-full truncate text-xs font-black text-white sm:text-sm">
                  {firstPlace.nickname}
                </h3>
                <span className="font-display text-xs font-bold tabular-nums text-arena-acid">
                  {firstPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="relative flex h-32 w-full flex-col items-center justify-center border-2 border-arena-ink bg-arena-signal shadow-[6px_6px_0_rgba(200,245,66,0.3)]">
                <div className="absolute inset-x-0 top-0 h-1 bg-arena-acid" />
                <span className="font-display text-3xl font-black text-white">1</span>
              </div>
            </div>
          )}

          {thirdPlace && (
            <div className="flex w-1/4 min-w-[70px] flex-col items-center gap-2 animate-scale-in">
              <div className="w-full min-w-0 text-center">
                <span className="font-display text-sm font-bold text-white/50">3rd</span>
                <h3 className="mt-0.5 w-full truncate text-[11px] font-extrabold text-white sm:text-xs">
                  {thirdPlace.nickname}
                </h3>
                <span className="font-display text-[10px] font-bold tabular-nums text-arena-acid">
                  {thirdPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="flex h-16 w-full flex-col items-center justify-center border-2 border-white/20 bg-arena-court shadow-[4px_4px_0_rgba(0,0,0,0.3)]">
                <span className="font-display text-2xl font-black text-white">3</span>
              </div>
            </div>
          )}
        </div>

        <div className="z-10 mb-4 w-full max-w-xs space-y-3 border-2 border-white/15 bg-white/[0.05] p-4">
          <div className="flex items-center justify-between border-b border-white/15 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              {t('yourPerformance')}
            </span>
            <span className="text-xs font-black text-arena-acid">
              #{finalRank ?? '-'} {t('rankWord')}
            </span>
          </div>
          {teamMode && player?.team_name && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Team ({player.team_name})</span>
              <span className="text-sm font-bold text-arena-acid">
                #{myTeamRank || '-'} · {teamRows.find((t) => t.team_name === player.team_name)?.score ?? 0} pts
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">{t('finalPoints')}</span>
            <span className="font-display text-lg font-black tabular-nums text-white">
              {player.score.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">{t('answerStreak')}</span>
            <span className="flex items-center gap-0.5 text-sm font-bold text-arena-acid">
              <Flame className="h-4 w-4 fill-current" /> {player.streak}
            </span>
          </div>
          {teamMode && teamRows.length > 0 && (
            <div className="space-y-1.5 border-t border-white/15 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {t('teamStandings')}
              </span>
              {teamRows.slice(0, 5).map((team, idx) => (
                <div key={team.team_name} className="flex justify-between text-xs">
                  <span className={team.team_name === player?.team_name ? 'font-bold text-arena-acid' : 'text-white/60'}>
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
          className="z-10 mb-4 h-11 w-full max-w-xs rounded-none border-2 border-white/30 bg-white/10 text-xs font-bold text-white hover:border-arena-acid hover:bg-arena-acid hover:text-arena-ink"
        >
          {t('returnToJoin')}
        </Button>
      </GameShell>
    );
  }

  // ==========================================
  // RENDER: ACTIVE QUESTION INTERFACES (INPUT MODES)
  // ==========================================
  if ((sessionStatus === 'question_active' || sessionStatus === 'question_paused') && activeQuestion) {
    // 1. SUBMITTED VIEW
    if (submissionState === 'submitted') {
      return (
        <GameShell className="items-center justify-center">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center bg-arena-acid font-display text-2xl font-extrabold text-arena-ink motion-pulse-soft">
              ✓
            </div>
            <h1 className="font-display text-3xl font-extrabold text-white">{t('answerLocked')}</h1>
            <p dir="auto" className="mt-2 text-sm font-bold text-arena-acid">{player.nickname}</p>
            {timeLeft > 0 && (
              <div className="mt-6 flex justify-center">
                <div
                  className={`relative flex h-24 w-24 flex-col items-center justify-center border-4 bg-black/35 transition-all duration-300 ${
                    timeLeft <= 5 ? 'scale-105 border-arena-signal' : 'border-arena-acid'
                  }`}
                >
                  <span
                    className={`font-display text-3xl font-extrabold tabular-nums ${
                      timeLeft <= 5 ? 'text-arena-signal' : 'text-white'
                    }`}
                  >
                    {timeLeft}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/45">{t('seconds')}</span>
                </div>
              </div>
            )}
            <p className="mt-6 max-w-xs text-sm text-white/55">
              {t('waitingForReveal')}
            </p>
            <p
              key={LOCK_WAIT_TIPS[lockTipIndex]}
              className="mt-2 min-h-[2.4rem] max-w-xs text-xs leading-relaxed text-white/40 animate-fade-in"
            >
              {t(LOCK_WAIT_TIPS[lockTipIndex])}
            </p>
            <div className="mt-6 w-full max-w-xs border border-white/15 bg-white/[0.06] p-4">
              <LobbyWaitMarks className="mb-2" onPick={sendLobbyReaction} />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{t('tapToCheer')}</p>
            </div>
          </div>
        </GameShell>
      );
    }

    if (submissionState === 'submitting') {
      return (
        <GameShell className="items-center justify-center">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-arena-acid" />
            <p className="text-sm font-semibold text-white/60">{t('lockingAnswer')}</p>
          </div>
        </GameShell>
      );
    }

    return (
      <GameShell padded={false}>
        <div className="relative flex min-h-dvh flex-col justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {sessionStatus === 'question_paused' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-arena-stage/85 p-6 text-center animate-fade-in">
            <Pause className="mb-3 h-12 w-12 text-arena-acid motion-pulse-soft" />
            <h2 className="mb-1 font-display text-xl font-bold text-white">{t('paused')}</h2>
            <p className="max-w-xs text-xs text-white/60">
              {t('pausedHint')}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-semibold text-white/50">
          <BrandMark tone="light" size="sm" wordmark={false} />
          <span dir="auto" className="max-w-[40%] truncate font-bold uppercase tracking-widest text-arena-acid">
            {player.nickname}
          </span>
          <span className="font-display font-extrabold text-white">{player.score}</span>
        </div>

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-6">
          <div className="mb-6 flex max-w-sm flex-col items-center space-y-4 text-center">
            {activeMultiplier > 1 && (
              <div className="mb-1 flex items-center gap-1 bg-arena-acid px-3 py-1.5 text-xs font-black uppercase tracking-wider text-arena-ink motion-pulse-soft">
                <Zap className="h-3.5 w-3.5" /> {activeMultiplier}x {t('pointsWord')}
              </div>
            )}
            
            {timeLeft > 0 && (
              <div className="my-2 flex justify-center">
                <div
                  className={`relative flex h-24 w-24 flex-col items-center justify-center border-4 bg-black/35 transition-all duration-300 ${
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

            <h2 dir="auto" className="font-display text-lg font-extrabold leading-snug tracking-tight text-white sm:text-xl">
              {activeQuestion.prompt}
            </h2>
          </div>

          {activeQuestion.type === 'type_answer' ? (
            <form onSubmit={handleTextSubmit} className="w-full space-y-4 border-2 border-white/15 bg-white/[0.05] p-6">
              <div className="mb-4 space-y-1 text-center">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-white/50">
                  Type your answer
                </h2>
              </div>

              <Input
                placeholder="Type here..."
                value={typeInputValue}
                onChange={(e) => setTypeInputValue(e.target.value)}
                className="h-14 rounded-none border-white/15 bg-arena-stage text-center text-lg font-bold focus-visible:ring-arena-acid"
                maxLength={40}
                required
              />

              <Button
                type="submit"
                className="h-12 w-full rounded-none bg-arena-signal text-base font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.3)] hover:brightness-110"
              >
                Lock answer
              </Button>
            </form>
          ) : activeQuestion.type === 'multi_select' ? (
            <div className="w-full space-y-6">
              <div className="mb-2 space-y-1 text-center">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-arena-acid">
                  Select all that apply
                </h2>
                <p className="text-xs text-white/50">
                  Tap every correct option, then lock in.
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-3">
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
                      className="min-h-[6.5rem] sm:min-h-[9rem]"
                    />
                  );
                })}
              </div>

              <Button
                onClick={handleMultiSubmit}
                className="h-12 w-full rounded-none bg-arena-signal text-base font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.3)] hover:brightness-110"
              >
                {t('lockAnswers')}
              </Button>
            </div>
          ) : (
            <div className="grid w-full grid-cols-2 gap-3">
              {activeQuestion.answers.map((ans) => (
                <AnswerButton
                  key={ans.id}
                  color={ans.color}
                  shape={ans.shape}
                  label={ans.text}
                  onClick={() => handleChoiceTap(ans.id)}
                  className="min-h-[6.75rem] sm:min-h-[9.5rem]"
                />
              ))}
            </div>
          )}
        </main>

        <div className="flex items-center justify-center gap-1.5 border-t border-white/10 py-4 text-center text-xs font-semibold text-white/50">
          <Clock className="h-4 w-4" />
          <span>{t('fasterLockHint')}</span>
        </div>
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell className="items-center justify-center">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-arena-acid" />
        <p className="text-sm font-semibold text-white/60">{t('loadingRoom')}</p>
      </div>
    </GameShell>
  );
}
