'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  kickPlayer,
  revealQuestionResults,
  goToLeaderboard,
  goToNextQuestion,
  goToPodium,
  createGameSession,
  endGameSession,
  setSessionMultiplier,
  startGameSession,
  pauseGameSession,
  resumeGameSession,
  addQuestionTime,
  setLateJoinThroughIndex,
  setHostLocale,
} from '@/lib/host/hostApi';
import { Flame, Users, Play, Pause, UserX, AlertCircle, Trophy, ArrowRight, Home, CheckCircle2, Clock, Settings, Edit3, Zap, SkipForward, Send, Activity, ChevronDown, ChevronUp, MessageSquare, X, ClipboardList, Smartphone, Link2, LogOut, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { bindAudioUnlock, playJoinSound, playTickSound, playRevealSound, playFanfareSound, unlockGameAudio } from '@/lib/sounds';
import { BrandMark, PinDisplay, StageBadge, playerChipColor } from '@/components/brand/BrandMark';
import { LobbyQr } from '@/components/brand/LobbyQr';
import { GameShell, LiveChip, StatBox } from '@/components/brand/GameShell';
import { ClashCountdownOverlay } from '@/components/brand/ClashCountdown';
import { LobbyReactionLayer, type FloatingReaction } from '@/components/brand/LobbyReactionLayer';
import { QLASH_CONFETTI } from '@/lib/game/theme';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import { useAutoCloseEmptyLobby } from '@/hooks/useAutoCloseEmptyLobby';
import {
  buildQuestionStartPayload,
  sanitizeAnswers,
  type Player,
  type LeaderboardPlayer,
  type Question,
  type GameSessionRow,
} from '@/lib/game/types';
import { maybeSeededShuffle, questionsInPlayOrder } from '@/lib/game/shuffle';
import { aggregateTeamScores, scoreBarPercent } from '@/lib/game/teams';
import { MAX_PLAYERS_PER_SESSION } from '@/lib/game/constants';
import { remainingSeconds } from '@/lib/game/clock';
import { answerUsesInk, resolveAnswerColor } from '@/lib/game/marks';
import { AnswerSwatch } from '@/components/brand/AnswerMark';
import { Switch } from '@/components/ui/switch';
import { hostClickerPath, isLateJoinEnabled, DEFAULT_LATE_JOIN_THROUGH_INDEX, LATE_JOIN_LOBBY_ONLY } from '@/lib/game/lateJoin';
import { lobbyJoinPath, lobbyWhatsAppHref } from '@/lib/game/lobbyLink';
import { podiumPath, podiumWhatsAppHref } from '@/lib/game/podiumShare';
import { waitingPlayers } from '@/lib/game/waitingPlayers';
import { connectedPlayerCount, isPlayerConnected } from '@/lib/game/emptyLobby';
import { buildTeachableReveal, formatTeachableCopy } from '@/lib/game/teachableReveal';
import {
  canCheerOnProjector,
  isLobbyReactionId,
  MAX_FLOATING_REACTIONS,
  REACTION_FLOAT_MS,
  reactionLeftPercent,
} from '@/lib/game/reactions';
import {
  FIRST_LOCK_BANNER_MS,
  answerPulsePercent,
  hottestStreak,
  isRoomLocked,
  shouldAnnounceFirstLock,
} from '@/lib/game/roomPulse';
import { LocaleToggle } from '@/components/brand/LocaleToggle';
import { useLocale } from '@/lib/i18n/useLocale';
import type { Locale } from '@/lib/i18n/locale';

const hostCtrl =
  'h-10 gap-1.5 rounded-none border-2 border-white/30 bg-white/10 px-3.5 font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-none hover:border-arena-acid hover:bg-arena-acid hover:text-arena-ink aria-expanded:border-arena-acid aria-expanded:bg-arena-acid aria-expanded:text-arena-ink [&_svg]:text-current';

const hostCta =
  'h-10 gap-1.5 rounded-none bg-arena-signal px-5 font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[4px_4px_0_rgba(0,0,0,0.35)] hover:brightness-110';

interface HostGameClientProps {
  initialSession: GameSessionRow;
  quiz: {
    id: string;
    title: string;
    randomize_questions?: boolean;
    randomize_answers?: boolean;
    team_mode?: boolean;
  };
  questions: Question[];
  initialPlayers: Player[];
  playerCap?: number;
  initialLocale?: Locale;
}

export default function HostGameClient({
  initialSession,
  quiz,
  questions,
  initialPlayers,
  playerCap = MAX_PLAYERS_PER_SESSION,
  initialLocale,
}: HostGameClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const sessionStatusRef = useRef(initialSession.status);
  const { send: sendSessionEvent } = useSessionChannel(initialSession.id, {
    supabase,
    onEvents: {
      'lobby:react': (msg) => {
        if (!canCheerOnProjector(sessionStatusRef.current)) return;
        const mark = msg.payload.mark;
        const nickname = String(msg.payload.nickname || '').trim().slice(0, 15);
        if (!isLobbyReactionId(mark) || !nickname) return;
        const item: FloatingReaction = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          mark,
          nickname,
          left: reactionLeftPercent(Math.floor(Math.random() * 84)),
        };
        setLobbyReactions((prev) => [...prev.slice(-(MAX_FLOATING_REACTIONS - 1)), item]);
        window.setTimeout(() => {
          setLobbyReactions((prev) => prev.filter((row) => row.id !== item.id));
        }, REACTION_FLOAT_MS);
      },
      'clash:countdown': () => {
        setClashRunning(true);
      },
    },
  });
  const { locale, setLocale, t } = useLocale(initialLocale);
  const persistLocale = (next: Locale) => {
    setLocale(next);
    void setHostLocale(next);
  };

  // Core game states
  const [session, setSession] = useState(initialSession);
  sessionStatusRef.current = session.status;
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const playersRef = useRef(players);
  playersRef.current = players;
  /** Session play order (may be shuffled once at start). */
  const [playQuestions, setPlayQuestions] = useState<Question[]>(() =>
    questionsInPlayOrder(questions, initialSession.question_order)
  );
  const randomizeQuestions = Boolean(quiz.randomize_questions);
  const randomizeAnswers = Boolean(quiz.randomize_answers);
  const teamMode = Boolean(quiz.team_mode);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [isManagePlayersOpen, setIsManagePlayersOpen] = useState(false);
  const [isWaitingOpen, setIsWaitingOpen] = useState(false);

  // Active question loop variables
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [firstLockName, setFirstLockName] = useState<string | null>(null);
  const firstLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revealData, setRevealData] = useState<{
    optionCounts: Record<string, number>;
    leaderboard: LeaderboardPlayer[];
  } | null>(null);

  // Live Question Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editAnswers, setEditAnswers] = useState<{ id: string; text: string }[]>([]);

  // Multiplier state (mirrored from session.active_multiplier)
  const [isMultiplierActive, setIsMultiplierActive] = useState(
    (initialSession.active_multiplier || 1) === 2
  );

  // Host Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

  // Activity Feed state
  const [activityFeed, setActivityFeed] = useState<{ id: string; type: string; message: string; time: Date }[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const activityFlushRef = useRef<{ type: string; message: string }[]>([]);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Question Jumper state
  const [isJumperOpen, setIsJumperOpen] = useState(false);
  const [clashRunning, setClashRunning] = useState(false);
  const clashLockRef = useRef(false);
  const [lobbyReactions, setLobbyReactions] = useState<FloatingReaction[]>([]);

  const [joinOrigin, setJoinOrigin] = useState('');

  useEffect(() => bindAudioUnlock(), []);

  useEffect(() => {
    setJoinOrigin(window.location.origin);
  }, []);

  const activeQuestionIndex = session.current_question_index;
  const activeQuestion = (playQuestions && playQuestions.length > 0)
    ? (playQuestions[activeQuestionIndex] || playQuestions[0])
    : null;
  const activeQuestionRef = useRef(activeQuestion);
  activeQuestionRef.current = activeQuestion;
  const submissionsCount = answeredIds.size;
  const waiting = waitingPlayers(players, answeredIds);
  const pulsePercent = answerPulsePercent(submissionsCount, players.length);
  const roomLocked = isRoomLocked(submissionsCount, players.length);
  const lateJoinOn = isLateJoinEnabled(session.late_join_through_index);
  const copyLobbyLink = useCallback(async () => {
    const url = `${window.location.origin}${lobbyJoinPath(session.pin)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('lobbyLinkCopied'));
    } catch {
      window.prompt(t('copyLobbyLink'), url);
    }
  }, [session.pin, t]);
  const shareLobbyWhatsApp = useCallback(() => {
    window.open(lobbyWhatsAppHref(window.location.origin, session.pin, locale), '_blank', 'noopener,noreferrer');
  }, [locale, session.pin]);
  const sharePodiumWhatsApp = useCallback(
    (top: { nickname: string; score: number }[]) => {
      window.open(
        podiumWhatsAppHref(window.location.origin, session.id, locale, quiz.title, top),
        '_blank',
        'noopener,noreferrer'
      );
    },
    [locale, quiz.title, session.id]
  );
  const copyPodiumLink = useCallback(async () => {
    const url = `${window.location.origin}${podiumPath(session.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('podiumShareCopied'));
    } catch {
      window.prompt(t('sharePodium'), url);
    }
  }, [session.id, t]);
  const closeEmptyLobby = useCallback(() => {
    void endGameSession(session.id)
      .catch(() => undefined)
      .finally(() => {
        toast.message(t('everyoneLeft'));
        router.push('/dashboard');
      });
  }, [session.id, router, t]);
  useAutoCloseEmptyLobby({
    status: session.status,
    players,
    initiallyOccupied: initialPlayers.length > 0,
    onClose: closeEmptyLobby,
  });
  const orderKey = Array.isArray(session.question_order) ? session.question_order.join(',') : '';
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);
  const displayedSecondRef = useRef<number | null>(null);
  const revealingRef = useRef(false);
  const playersFlushRef = useRef<Map<string, Player>>(new Map());
  const playersFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (playersFlushTimerRef.current) clearTimeout(playersFlushTimerRef.current);
      if (firstLockTimerRef.current) clearTimeout(firstLockTimerRef.current);
    };
  }, []);

  // Debounced activity feed to avoid UI thrash at ~80 players
  const addActivityEntry = useCallback((type: string, message: string) => {
    activityFlushRef.current.push({ type, message });
    if (activityTimerRef.current) return;
    activityTimerRef.current = setTimeout(() => {
      const batch = activityFlushRef.current.splice(0);
      activityTimerRef.current = null;
      if (batch.length === 0) return;
      setActivityFeed((prev) => [
        ...batch.map((entry) => ({
          id: crypto.randomUUID(),
          type: entry.type,
          message: entry.message,
          time: new Date(),
        })).reverse(),
        ...prev,
      ].slice(0, 50));
    }, 250);
  }, []);

  // Reveal Question results (grades, computes scoreboard, triggers reveal status)
  const handleRevealAnswer = React.useCallback(async () => {
    if (revealingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (!activeQuestion) return;
    revealingRef.current = true;

    playRevealSound();
    const loadingToast = toast.loading('Calculating scores...');
    try {
      const results = await revealQuestionResults(session.id, activeQuestion.id);
      setRevealData(results);

      const correctOptionIds = activeQuestion.answers
        .filter((ans) => ans.is_correct)
        .map((ans) => ans.id);

      void sendSessionEvent('question:reveal', {
        correct_answer_ids: correctOptionIds,
        option_counts: results.optionCounts,
      });

      toast.success('Results calculated!', { id: loadingToast });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reveal results.', { id: loadingToast });
    } finally {
      revealingRef.current = false;
    }
  }, [session.id, activeQuestion, sendSessionEvent]);

  // One Realtime channel for players, session row, and submissions
  useEffect(() => {
    const flushPlayerUpdates = () => {
      if (playersFlushTimerRef.current) {
        clearTimeout(playersFlushTimerRef.current);
        playersFlushTimerRef.current = null;
      }
      const batch = playersFlushRef.current;
      if (batch.size === 0) return;
      playersFlushRef.current = new Map();
      setPlayers((prev) => prev.map((player) => batch.get(player.id) ?? player));
    };

    const channel = supabase
      .channel(`host_live_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => {
              if (prev.find((p) => p.id === payload.new.id)) return prev;
              playJoinSound();
              addActivityEntry('join', `${(payload.new as Player).nickname} joined the lobby`);
              return [...prev, payload.new as Player];
            });
          } else if (payload.eventType === 'DELETE') {
            const removed = playersRef.current.find((p) => p.id === payload.old.id);
            if (removed) addActivityEntry('kick', `${removed.nickname} was removed`);
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const next = payload.new as Player;
            const prev = playersRef.current.find((p) => p.id === next.id);
            playersFlushRef.current.set(next.id, next);
            const connectedChanged = prev != null && prev.connected !== next.connected;
            if (connectedChanged) {
              flushPlayerUpdates();
            } else if (!playersFlushTimerRef.current) {
              playersFlushTimerRef.current = setTimeout(flushPlayerUpdates, 120);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updatedSession = payload.new as typeof session;
          setSession(updatedSession);
          if (typeof updatedSession.active_multiplier === 'number') {
            setIsMultiplierActive(updatedSession.active_multiplier === 2);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answers_submitted',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const question = activeQuestionRef.current;
          if (question && payload.new.question_id === question.id) {
            const playerId = payload.new.player_id as string;
            const answerer = playersRef.current.find((p) => p.id === playerId);
            let becameFirst = false;
            setAnsweredIds((prev) => {
              if (prev.has(playerId)) return prev;
              becameFirst = shouldAnnounceFirstLock(prev.size, prev.size + 1);
              const next = new Set(prev);
              next.add(playerId);
              return next;
            });
            if (becameFirst && answerer) {
              setFirstLockName(answerer.nickname);
              if (firstLockTimerRef.current) clearTimeout(firstLockTimerRef.current);
              firstLockTimerRef.current = setTimeout(() => setFirstLockName(null), FIRST_LOCK_BANNER_MS);
            }
            if (answerer) addActivityEntry('answer', `${answerer.nickname} submitted an answer`);
          }
        }
      )
      .subscribe();

    return () => {
      if (playersFlushTimerRef.current) {
        clearTimeout(playersFlushTimerRef.current);
        playersFlushTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [supabase, session.id, addActivityEntry]);

  useEffect(() => {
    const questionId = activeQuestion?.id;
    if (!questionId) {
      setAnsweredIds(new Set());
      setFirstLockName(null);
      return;
    }
    let cancelled = false;
    setAnsweredIds(new Set());
    setFirstLockName(null);
    void supabase
      .from('answers_submitted')
      .select('player_id')
      .eq('session_id', session.id)
      .eq('question_id', questionId)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setAnsweredIds(new Set(data.map((row) => row.player_id as string)));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, session.id, activeQuestion?.id]);

  useEffect(() => {
    if (session.status !== 'question_reveal' || !activeQuestion) return;
    let cancelled = false;
    void revealQuestionResults(session.id, activeQuestion.id)
      .then((results) => {
        if (!cancelled) setRevealData(results);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session.status, session.id, activeQuestion?.id]);

  useEffect(() => {
    if (session.status !== 'question_active' || !session.question_started_at || !activeQuestion) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    lastTickSecondRef.current = null;
    displayedSecondRef.current = null;

    const timeLimit = activeQuestion.time_limit_seconds;
    const startedAt = new Date(session.question_started_at).getTime();

    const updateTimer = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
      if (remaining !== displayedSecondRef.current) {
        displayedSecondRef.current = remaining;
        setTimeLeft(remaining);
      }

      if (remaining <= 5 && remaining > 0 && remaining !== lastTickSecondRef.current) {
        lastTickSecondRef.current = remaining;
        playTickSound();
      }

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleRevealAnswer();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session.status, session.question_started_at, activeQuestion?.id, activeQuestion?.time_limit_seconds, handleRevealAnswer]);

  useEffect(() => {
    if (session.status !== 'finished') return;
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
  }, [session.status]);

  // Kick Player Handler
  const handleKickPlayer = async (playerId: string, nickname: string) => {
    if (kickingId) return;
    setKickingId(playerId);
    try {
      await kickPlayer(playerId, session.id);
      toast.success(`Kicked player "${nickname}" from the lobby.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to kick player.');
    } finally {
      setKickingId(null);
    }
  };

  // Toggle Pause/Resume (server actions — single trust boundary)
  const handleTogglePause = async () => {
    const isPaused = session.status === 'question_paused';
    try {
      if (isPaused) {
        const { serverStartedAt } = await resumeGameSession(session.id);
        void sendSessionEvent('timer:sync', {
          status: 'question_active',
          server_started_at: serverStartedAt,
          remaining_seconds: activeQuestion
            ? remainingSeconds(serverStartedAt, activeQuestion.time_limit_seconds)
            : timeLeft,
        });
        toast.success('Game resumed!');
      } else {
        const remaining = timeLeft;
        await pauseGameSession(session.id);
        void sendSessionEvent('timer:sync', {
          status: 'question_paused',
          remaining_seconds: remaining,
        });
        toast.success('Game paused!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle pause.');
    }
  };

  const handleAddTime = async () => {
    if (!session.question_started_at) return;
    try {
      const { serverStartedAt } = await addQuestionTime(session.id, 10);
      const remaining = timeLeft + 10;
      setTimeLeft(remaining);
      void sendSessionEvent('timer:sync', {
        status: session.status,
        server_started_at: serverStartedAt,
        remaining_seconds: remaining,
      });
      toast.success('Added 10 seconds to the clock!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add time.');
    }
  };

  const prepareQuestionForPlay = useCallback(
    (question: Question): Question => ({
      ...question,
      answers: maybeSeededShuffle(
        question.answers,
        randomizeAnswers,
        `${session.id}:${question.id}`
      ),
    }),
    [randomizeAnswers, session.id]
  );

  useEffect(() => {
    if (!orderKey) return;
    setPlayQuestions(
      questionsInPlayOrder(questions, session.question_order).map(prepareQuestionForPlay)
    );
  }, [orderKey, questions, prepareQuestionForPlay, session.question_order]);

  // Start Game — 3-2-1 Clash, then the clock starts
  const commitStartGame = useCallback(async () => {
    try {
      const ordered = maybeSeededShuffle(questions, randomizeQuestions, `${session.id}:order`).map(
        prepareQuestionForPlay
      );
      setPlayQuestions(ordered);

      const { serverStartedAt } = await startGameSession(
        session.id,
        ordered.map((q) => q.id)
      );
      setIsMultiplierActive(false);
      revealingRef.current = false;

      const firstQ = ordered[0];
      void sendSessionEvent('question:start', buildQuestionStartPayload(firstQ, 0, serverStartedAt));

      toast.success(
        randomizeQuestions
          ? 'Game started! Question order randomized.'
          : 'Game started! Broadcasting first question.'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start game.');
    } finally {
      setClashRunning(false);
      clashLockRef.current = false;
    }
  }, [questions, randomizeQuestions, session.id, prepareQuestionForPlay, sendSessionEvent]);

  const handleStartGame = async () => {
    void unlockGameAudio();
    if (clashLockRef.current || clashRunning) return;
    if (!questions || questions.length === 0) {
      toast.error('You cannot start a game with 0 questions.');
      return;
    }
    if (players.length === 0) {
      toast.error('You cannot start a game with 0 players.');
      return;
    }
    clashLockRef.current = true;
    setClashRunning(true);
    void sendSessionEvent('clash:countdown', { at: Date.now() });
  };



  // Move to Leaderboard View
  const handleShowLeaderboard = async () => {
    try {
      await goToLeaderboard(session.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to show leaderboard.');
    }
  };

  // Progress to Next Question
  const handleNextQuestion = async () => {
    try {
      const nextIndex = activeQuestionIndex + 1;
      const nextQ = prepareQuestionForPlay(playQuestions[nextIndex]);
      setPlayQuestions((prev) => {
        const copy = [...prev];
        copy[nextIndex] = nextQ;
        return copy;
      });

      const { serverStartedAt } = await goToNextQuestion(session.id, nextIndex);
      setRevealData(null);
      setIsMultiplierActive(false);
      revealingRef.current = false;

      void sendSessionEvent('question:start', buildQuestionStartPayload(nextQ, nextIndex, serverStartedAt));

      toast.success('Loading next question.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load next question.');
    }
  };

  // Show final podium screen
  const handleShowPodium = async () => {
    try {
      await goToPodium(session.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to show podium.');
    }
  };

  // Return to Dashboard and terminate game room
  const handleCloseSession = async () => {
    try {
      await endGameSession(session.id);
      router.push('/dashboard');
      router.refresh();
    } catch {
      router.push('/dashboard');
    }
  };

  const handleOpenReport = () => {
    router.push(`/dashboard/sessions/${session.id}`);
  };

  const handlePlayAgain = async () => {
    const loading = toast.loading('Opening a new lobby…');
    try {
      const next = await createGameSession(quiz.id);
      toast.success('Lobby ready.', { id: loading });
      router.push(`/host/${next.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start a new room.', { id: loading });
    }
  };

  // ==========================================
  // NEW FEATURE HANDLERS
  // ==========================================


  // Live Question Editor: Open modal with current question data
  const handleOpenEditor = () => {
    if (!activeQuestion) return;
    setEditPrompt(activeQuestion.prompt);
    setEditAnswers(activeQuestion.answers.map((ans) => ({ id: ans.id, text: ans.text })));
    setIsEditorOpen(true);
  };

  // Live Question Editor: Save changes to DB and broadcast update
  const handleSaveQuestionEdit = async () => {
    if (!activeQuestion) return;
    try {
      // Update question in database
      const updatedAnswers = activeQuestion.answers.map((ans) => {
        const edited = editAnswers.find((ea) => ea.id === ans.id);
        return edited ? { ...ans, text: edited.text } : ans;
      });

      const { error } = await supabase
        .from('questions')
        .update({
          prompt: editPrompt,
          answers: updatedAnswers,
        })
        .eq('id', activeQuestion.id);

      if (error) throw error;

      activeQuestion.prompt = editPrompt;
      activeQuestion.answers = updatedAnswers;

      await sendSessionEvent('question:update', {
        prompt: editPrompt,
        answers: sanitizeAnswers(updatedAnswers),
      });

      setIsEditorOpen(false);
      addActivityEntry('edit', 'Host edited the current question live');
      toast.success('Question updated and broadcasted to players!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save question edits.');
    }
  };

  // Multiplier Toggle: persist on session (server-owned) then broadcast UX cue
  const handleToggleMultiplier = async () => {
    const newState = !isMultiplierActive;
    try {
      await setSessionMultiplier(session.id, newState ? 2 : 1);
      setIsMultiplierActive(newState);

      await sendSessionEvent('multiplier:change', { multiplier: newState ? 2 : 1 });

      addActivityEntry('multiplier', newState ? 'Double points activated!' : 'Double points deactivated');
      toast.success(newState ? 'Double Points Activated! (2x)' : 'Multiplier Deactivated (1x)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle multiplier.');
    }
  };

  // Question Jumper: Jump to any question index
  const handleJumpToQuestion = async (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= playQuestions.length || targetIndex === activeQuestionIndex) return;
    try {
      const targetQ = prepareQuestionForPlay(playQuestions[targetIndex]);
      setPlayQuestions((prev) => {
        const copy = [...prev];
        copy[targetIndex] = targetQ;
        return copy;
      });

      const { serverStartedAt } = await goToNextQuestion(session.id, targetIndex);
      setRevealData(null);
      setIsMultiplierActive(false);
      setIsJumperOpen(false);
      revealingRef.current = false;

      void sendSessionEvent(
        'question:start',
        buildQuestionStartPayload(targetQ, targetIndex, serverStartedAt)
      );

      addActivityEntry('jump', `Host jumped to Question ${targetIndex + 1}`);
      toast.success(`Jumped to Question ${targetIndex + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to jump to question.');
    }
  };

  // Host Announcement: Send a text message to all players
  const handleSendAnnouncement = async () => {
    if (!announcementText.trim()) {
      toast.error('Please enter a message to broadcast.');
      return;
    }

    await sendSessionEvent('host:announcement', { message: announcementText.trim() });

    addActivityEntry('announcement', `Host broadcast: "${announcementText.trim()}"`);
    toast.success('Announcement sent to all players!');
    setAnnouncementText('');
    setIsAnnouncementOpen(false);
  };

  const connectedCount = connectedPlayerCount(players);
  const isLastQuestion = activeQuestionIndex === playQuestions.length - 1;
  const quitControl = (
    <Button type="button" variant="ghost" className={hostCtrl} onClick={() => void handleCloseSession()}>
      <LogOut className="h-3.5 w-3.5" /> {t('quitRoom')}
    </Button>
  );

  // ==========================================
  // RENDER: LOBBY STATE
  // ==========================================
  if (session.status === 'lobby') {
    return (
      <div className="arena-stage arena-noise relative flex min-h-dvh w-full flex-col justify-between overflow-x-hidden font-sans">
        <LobbyReactionLayer items={lobbyReactions} />
        <ClashCountdownOverlay
          play={clashRunning}
          clashWord={t('clash')}
          onDone={() => {
            if (clashLockRef.current) void commitStartGame();
            else setClashRunning(false);
          }}
        />
        <div className="pointer-events-none absolute inset-0 arena-grid opacity-[0.18]" />
        <div className="pointer-events-none absolute -right-16 top-16 hidden h-48 w-48 rotate-[14deg] bg-arena-acid motion-breathe sm:block" />
        <div className="pointer-events-none absolute bottom-28 -left-6 hidden h-24 w-24 -rotate-6 bg-arena-signal sm:block" />
        <div className="pointer-events-none absolute bottom-16 left-24 hidden h-10 w-40 bg-arena-court sm:block" />

        <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark tone="light" size="sm" />
            <div className="hidden min-w-0 border-l border-white/15 pl-4 sm:block">
              <p dir="auto" className="truncate font-display text-sm font-bold text-white">{quiz.title}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">{t('liveLobby')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <LocaleToggle locale={locale} onChange={persistLocale} tone="light" />
            <div className="hidden sm:block">{quitControl}</div>
            <StageBadge className="motion-pulse-soft max-w-[11rem] truncate sm:max-w-none">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {connectedCount}/{players.length} · max {playerCap}
            </StageBadge>
          </div>
        </header>

        <main className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-12 lg:gap-8 lg:py-10">
          <div className="order-1 flex flex-col justify-center gap-3 text-center sm:gap-5 lg:order-1 lg:col-span-3 lg:gap-8 lg:text-left">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-arena-acid sm:text-[11px] sm:tracking-[0.28em]">
                {t('joinOnPhone')}
              </p>
              <h2 className="mt-3 hidden font-display text-5xl font-extrabold leading-[0.9] tracking-[-0.03em] text-white lg:block lg:text-6xl">
                {t('enterPin')}
                <span className="mt-1 block text-arena-acid">{t('thePin')}</span>
              </h2>
              <p className="mx-auto mt-4 hidden max-w-sm text-sm font-medium text-white/50 lg:mx-0 lg:block">
                {t('lobbyHint')}
              </p>
            </div>

            <div className="mx-auto w-full max-w-md border-2 border-arena-ink bg-white p-3 text-center shadow-[8px_8px_0_rgba(0,0,0,0.35)] sm:p-5 lg:mx-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-arena-ink/40">{t('roomPin')}</p>
              <div className="mt-2 sm:mt-3">
                <PinDisplay pin={session.pin} large />
              </div>
            </div>
          </div>

          <div className="order-2 flex flex-col items-center justify-center gap-3 lg:col-span-5">
            <LobbyQr
              value={joinOrigin ? `${joinOrigin}${lobbyJoinPath(session.pin)}` : ''}
              caption={t('scan')}
            />
            <div className="flex w-[min(100%,22rem)] gap-2 lg:hidden">
              <Button
                type="button"
                variant="ghost"
                className={`${hostCtrl} min-h-12 flex-1`}
                onClick={() => void copyLobbyLink()}
              >
                <Link2 className="h-4 w-4" /> {t('copyLobbyLink')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={`${hostCtrl} min-h-12 flex-1`}
                onClick={shareLobbyWhatsApp}
              >
                <MessageCircle className="h-4 w-4" /> {t('shareWhatsApp')}
              </Button>
            </div>
          </div>

          <div className="order-3 relative z-10 flex min-h-0 flex-col gap-4 self-stretch border border-white/12 bg-white/[0.04] p-4 backdrop-blur-[2px] sm:p-6 lg:col-span-4 lg:min-h-[48vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/55">
                <Users className="h-4 w-4 text-arena-acid" /> {t('players')}
                <span className="text-white">{players.length}</span>
              </span>
            </div>

            {(!questions || questions.length === 0) && (
              <div className="mb-2 flex items-center gap-3 border border-arena-signal/50 bg-arena-signal/15 p-4 text-xs font-semibold text-rose-100">
                <AlertCircle className="h-5 w-5 shrink-0 text-arena-signal" />
                <div>
                  <p className="font-bold">This quiz has 0 questions</p>
                  <p className="mt-0.5 text-rose-100/70">Add questions in the editor before starting.</p>
                </div>
              </div>
            )}

            {players.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-6 flex items-center gap-2" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="flex h-11 w-11 items-center justify-center border-2 border-dashed border-white/20 bg-white/[0.04]"
                      style={{ animationDelay: `${i * 160}ms` }}
                    >
                      <span className="h-2 w-2 animate-pulse bg-arena-acid/70" />
                    </span>
                  ))}
                </div>
                <p className="font-display text-xl font-bold text-white">{t('waitingForPlayers')}</p>
                <p className="mt-2 max-w-xs text-xs text-white/40">{t('nicknamesLand')}</p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    className={hostCtrl}
                    onClick={() => void copyLobbyLink()}
                  >
                    <Link2 className="h-4 w-4" /> {t('copyLobbyLink')}
                  </Button>
                  <Button type="button" variant="ghost" className={hostCtrl} onClick={shareLobbyWhatsApp}>
                    <MessageCircle className="h-4 w-4" /> {t('shareWhatsApp')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="max-h-40 flex-1 overflow-y-auto pr-1 sm:max-h-[52vh]">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className={`group relative flex items-center gap-2.5 border px-3 py-2.5 transition ${
                        isPlayerConnected(p)
                          ? 'border-white/15 bg-white/10 text-white'
                          : 'border-white/5 bg-white/[0.03] text-white/35'
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center font-display text-xs font-extrabold text-white"
                        style={{ backgroundColor: playerChipColor(p.nickname) }}
                      >
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </span>
                      <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-bold">{p.nickname}</span>
                      <button
                        type="button"
                        disabled={!!kickingId}
                        onClick={() => handleKickPlayer(p.id, p.nickname)}
                        className="shrink-0 text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-arena-signal"
                        title="Kick Player"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                      {!isPlayerConnected(p) && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-arena-signal" title="Offline" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="sticky bottom-0 z-20 flex flex-col items-stretch justify-between gap-3 border-t border-white/10 bg-arena-stage/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-5 sm:flex-row sm:items-center lg:static lg:bg-black/20 lg:backdrop-blur-none">
          <div className="flex flex-col gap-3 sm:max-w-md">
            <p className="hidden text-center text-xs uppercase tracking-[0.14em] text-white/40 sm:block sm:text-left">
              Keep this screen visible · PIN <bdi className="text-white font-bold">{session.pin}</bdi>
            </p>
            <label className="flex items-center justify-between gap-3 border border-white/15 bg-white/5 px-3 py-2">
              <span>
                <span className="block text-xs font-bold text-white/80">{t('lateJoin')}</span>
                <span className="mt-0.5 hidden text-[10px] font-medium leading-snug text-white/40 sm:block">
                  {t('lateJoinHint')}
                </span>
              </span>
              <Switch
                checked={lateJoinOn}
                onCheckedChange={(enabled) => {
                  const value = enabled ? DEFAULT_LATE_JOIN_THROUGH_INDEX : LATE_JOIN_LOBBY_ONLY;
                  void setLateJoinThroughIndex(session.id, value)
                    .then((result) => {
                      setSession((prev) => ({
                        ...prev,
                        late_join_through_index: result.late_join_through_index,
                      }));
                    })
                    .catch((err: unknown) => {
                      toast.error(err instanceof Error ? err.message : 'Could not update late join.');
                    });
                }}
                className="data-checked:bg-arena-acid"
              />
            </label>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {quitControl}
            <Button
              type="button"
              variant="ghost"
              className={hostCtrl}
              onClick={() => void copyLobbyLink()}
            >
              <Link2 className="h-4 w-4" /> {t('copyLobbyLink')}
            </Button>
            <Button type="button" variant="ghost" className={hostCtrl} onClick={shareLobbyWhatsApp}>
              <MessageCircle className="h-4 w-4" /> {t('shareWhatsApp')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={hostCtrl}
              onClick={async () => {
                const url = `${window.location.origin}${hostClickerPath(session.id)}`;
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success(t('clickerCopied'));
                } catch {
                  window.open(hostClickerPath(session.id), '_blank');
                }
              }}
            >
              <Smartphone className="h-4 w-4" /> {t('phoneClicker')}
            </Button>
            <Button
              onClick={handleStartGame}
              disabled={clashRunning || players.length === 0 || !questions || questions.length === 0}
              className="h-14 w-full rounded-none bg-arena-acid px-10 font-display text-lg font-extrabold text-arena-ink shadow-[6px_6px_0_rgba(200,245,66,0.25)] hover:brightness-105 sm:w-auto"
            >
              <Play className="mr-2 h-5 w-5 fill-current" /> {clashRunning ? t('starting') : t('startGame')}
            </Button>
          </div>
        </footer>
      </div>
    );
  }


  // ==========================================
  // RENDER: ACTIVE QUESTION STATE (TIMER COUNTDOWN)
  // ==========================================
  if (session.status === 'question_active' || session.status === 'question_paused') {
    if (!activeQuestion) return null;
    const isPaused = session.status === 'question_paused';
    return (
      <GameShell>
        <LobbyReactionLayer items={lobbyReactions} />
        {firstLockName && (
          <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-4">
            <div className="border-2 border-arena-acid bg-arena-acid px-3 py-2 font-display text-xs font-black uppercase tracking-[0.16em] text-arena-ink shadow-[6px_6px_0_rgba(0,0,0,0.35)] animate-scale-in sm:px-5 sm:text-sm">
              {t('firstLock')} · {firstLockName}
            </div>
          </div>
        )}
        <div className="z-10 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <LiveChip>
              Question {activeQuestionIndex + 1} of {playQuestions.length}
            </LiveChip>

            {/* Question Jumper Dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setIsJumperOpen(!isJumperOpen)}
                className={cn(hostCtrl, isJumperOpen && 'border-arena-acid bg-arena-acid text-arena-ink')}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Jump
                {isJumperOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              {isJumperOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 max-h-60 w-56 overflow-y-auto border-2 border-white/20 bg-arena-stage p-1.5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] animate-fade-in">
                  {playQuestions.map((q, idx) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleJumpToQuestion(idx)}
                      className={`w-full px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        idx === activeQuestionIndex
                          ? 'bg-arena-signal text-white cursor-default'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="font-black">Q{idx + 1}</span>{' '}
                      <span dir="auto" className="truncate text-white/60">{q.prompt.slice(0, 30)}{q.prompt.length > 30 ? '...' : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isMultiplierActive && (
              <span className="inline-flex items-center gap-1 bg-arena-acid px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-arena-ink motion-pulse-soft">
                <Zap className="h-3 w-3" /> 2x Points
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {quitControl}
            <BrandMark tone="light" size="sm" wordmark={false} />
          </div>
        </div>

        <div className="z-10 mx-auto my-6 max-w-4xl text-center">
          <h1 dir="auto" className="font-display text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            {activeQuestion.prompt}
          </h1>
        </div>

        <div className="z-10 mx-auto grid w-full max-w-5xl flex-1 grid-cols-2 items-center justify-center gap-4 md:grid-cols-12 md:gap-8">
          <div className="order-2 flex flex-col items-center justify-center text-center md:order-1 md:col-span-3">
            <StatBox
              value={timeLeft}
              label={isPaused ? t('paused') : t('seconds')}
              tone={timeLeft <= 5 && !isPaused ? 'signal' : 'acid'}
              pulse={isPaused || timeLeft <= 5}
            />
          </div>

          <div className="order-1 col-span-2 flex h-40 w-full items-center justify-center sm:h-64 md:order-2 md:col-span-6 md:h-80">
            {activeQuestion.media_url ? (
              activeQuestion.media_type === 'video' ? (
                <video
                  src={activeQuestion.media_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="max-h-full max-w-full border-2 border-arena-ink object-contain shadow-[8px_8px_0_rgba(0,0,0,0.35)]"
                />
              ) : (
                <img
                  // eslint-disable-next-line @next/next/no-img-element
                  src={activeQuestion.media_url}
                  alt="Question Media"
                  className="max-h-full max-w-full border-2 border-arena-ink object-contain shadow-[8px_8px_0_rgba(0,0,0,0.35)]"
                />
              )
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center border-2 border-white/15 bg-white/[0.04] p-8 text-center">
                <Flame className="mb-3 h-16 w-16 text-arena-acid/50 motion-pulse-soft" />
                <span className="font-display text-xs font-extrabold uppercase tracking-[0.22em] text-white/50">
                  Qlash Showdown
                </span>
              </div>
            )}
          </div>

          <div className="order-3 flex flex-col items-center justify-center text-center md:col-span-3">
            <StatBox
              value={submissionsCount}
              label={t('answersCount')}
              tone={roomLocked ? 'acid' : 'court'}
              pulse={roomLocked}
            />
            <div className="mt-3 h-2 w-32 overflow-hidden bg-white/10">
              <div
                className={`h-full transition-all duration-500 ${roomLocked ? 'bg-arena-acid' : 'bg-arena-court'}`}
                style={{ width: `${pulsePercent}%` }}
              />
            </div>
            <span className="mt-2 text-xs font-medium text-white/55">
              {roomLocked
                ? t('roomLocked')
                : `${waiting.length} ${t('waiting')} · ${players.length} ${t('inRoom')}`}
            </span>
          </div>
        </div>

        {/* Answers Grid layout */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-5xl w-full mx-auto mt-6 z-10">
          {activeQuestion.answers.map((ans) => (
            <div
              key={ans.id}
              className={`flex items-center gap-3.5 border-2 border-arena-ink p-4 select-none font-bold transition-all text-lg ${
                answerUsesInk(ans.color) ? 'text-arena-ink' : 'text-white'
              }`}
              style={{ backgroundColor: resolveAnswerColor(ans.color) }}
            >
              <AnswerSwatch
                shape={ans.shape}
                color={ans.color}
                className="h-10 w-10"
                markClassName="h-5 w-5"
              />
              <span dir="auto" className="truncate">{ans.text}</span>
            </div>
          ))}
        </div>

        {/* Host controls footer */}
        <div className="z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-xs font-semibold text-white/50">
            PIN: <bdi>{session.pin}</bdi>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={isWaitingOpen} onOpenChange={setIsWaitingOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" className={hostCtrl}>
                    <Users className="h-4 w-4" /> {t('waiting')} ({waiting.length})
                  </Button>
                }
              />
              <DialogContent className="max-w-md rounded-none border-2 border-white/20 bg-arena-stage text-white shadow-[8px_8px_0_rgba(0,0,0,0.45)]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-white">Still answering</DialogTitle>
                  <DialogDescription className="text-xs text-white/50">
                    Only you see this list — it is not on the question stage.
                  </DialogDescription>
                </DialogHeader>
                <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
                  {waiting.length === 0 ? (
                    <li className="py-4 text-center text-sm text-white/50">Everyone has answered.</li>
                  ) : (
                    waiting.map((player) => (
                      <li key={player.id} className="flex items-center justify-between border border-white/15 bg-white/10 px-3 py-2">
                        <span dir="auto" className="truncate text-sm font-bold">{player.nickname}</span>
                        {!isPlayerConnected(player) ? (
                          <span className="text-[10px] uppercase tracking-wider text-white/40">offline</span>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </DialogContent>
            </Dialog>
            <Button
              type="button"
              variant="ghost"
              className={hostCtrl}
              onClick={() => window.open(hostClickerPath(session.id), '_blank')}
            >
              <Smartphone className="h-4 w-4" /> Clicker
            </Button>
            {/* Manage Players Dialog */}
            <Dialog open={isManagePlayersOpen} onOpenChange={setIsManagePlayersOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" className={hostCtrl}>
                    <Settings className="h-4 w-4" /> Players ({players.length})
                  </Button>
                }
              />
              <DialogContent className="max-w-md rounded-none border-2 border-white/20 bg-arena-stage text-white shadow-[8px_8px_0_rgba(0,0,0,0.45)]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
                    <Users className="h-5 w-5 text-arena-acid" /> Manage Session Players
                  </DialogTitle>
                  <DialogDescription className="text-xs text-white/50">
                    Kick players who are idle, names are inappropriate, or who have disconnected.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {players.length === 0 ? (
                    <p className="py-4 text-center text-sm text-white/50">No players joined yet.</p>
                  ) : (
                    players.map((p) => (
                      <div key={p.id} className="flex items-center justify-between border border-white/15 bg-white/10 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2 w-2 ${isPlayerConnected(p) ? 'bg-arena-acid' : 'bg-arena-signal'}`} />
                          <span className="max-w-[180px] truncate text-sm font-bold">{p.nickname}</span>
                          <span className="text-[10px] text-white/50">({p.score} pts)</span>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!!kickingId}
                          onClick={() => handleKickPlayer(p.id, p.nickname)}
                          className="flex h-8 items-center gap-1 rounded-none bg-arena-signal px-3 text-xs font-bold text-white hover:brightness-110"
                        >
                          <UserX className="h-3.5 w-3.5" /> Kick
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Live Question Editor */}
            <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" onClick={handleOpenEditor} className={hostCtrl}>
                    <Edit3 className="h-4 w-4" /> Edit
                  </Button>
                }
              />
              <DialogContent className="max-w-lg rounded-none border-2 border-white/20 bg-arena-stage text-white shadow-[8px_8px_0_rgba(0,0,0,0.45)]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
                    <Edit3 className="h-5 w-5 text-arena-acid" /> Live Question Editor
                  </DialogTitle>
                  <DialogDescription className="text-xs text-white/50">
                    Edit the current question prompt and answers live. Changes broadcast instantly to all players.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Question Prompt</label>
                    <Textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      className="min-h-[80px] rounded-none border-white/15 bg-white/10 text-white focus-visible:ring-arena-acid"
                      placeholder="Enter the question..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Answer Options</label>
                    {editAnswers.map((ans, idx) => (
                      <div key={ans.id} className="flex items-center gap-2">
                        <span className="w-5 text-[10px] font-black text-white/50">{idx + 1}.</span>
                        <Input
                          value={ans.text}
                          onChange={(e) => {
                            const updated = [...editAnswers];
                            updated[idx] = { ...updated[idx], text: e.target.value };
                            setEditAnswers(updated);
                          }}
                          className="h-9 rounded-none border-white/15 bg-white/10 text-sm text-white focus-visible:ring-arena-acid"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleSaveQuestionEdit}
                    className="h-10 w-full rounded-none bg-arena-acid text-sm font-bold text-arena-ink hover:brightness-105"
                  >
                    Save & Broadcast Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Multiplier Toggle */}
            <Button
              onClick={handleToggleMultiplier}
              variant="ghost"
              className={cn(
                hostCtrl,
                isMultiplierActive && 'border-amber-400 bg-amber-400 text-arena-ink hover:border-amber-300 hover:bg-amber-300'
              )}
            >
              <Zap className={cn('h-4 w-4', isMultiplierActive && 'fill-current')} />
              {isMultiplierActive ? '2x On' : '2x'}
            </Button>

            {/* Host Announcement */}
            <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" className={hostCtrl}>
                    <MessageSquare className="h-4 w-4" /> Chat
                  </Button>
                }
              />
              <DialogContent className="max-w-sm rounded-none border-2 border-white/20 bg-arena-stage text-white shadow-[8px_8px_0_rgba(0,0,0,0.45)]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
                    <MessageSquare className="h-5 w-5 text-arena-acid" /> Broadcast Announcement
                  </DialogTitle>
                  <DialogDescription className="text-xs text-white/50">
                    Send a message to all player screens instantly.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-3 space-y-3">
                  <Input
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Type your message..."
                    maxLength={120}
                    className="h-11 rounded-none border-white/15 bg-white/10 text-white focus-visible:ring-arena-acid"
                  />
                  <Button
                    onClick={handleSendAnnouncement}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-none bg-arena-signal text-sm font-bold text-white hover:brightness-110"
                  >
                    <Send className="h-4 w-4" /> Send to All Players
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Activity Feed Toggle */}
            <Button
              onClick={() => setIsActivityOpen(!isActivityOpen)}
              variant="ghost"
              className={cn(
                hostCtrl,
                isActivityOpen && 'border-arena-acid bg-arena-acid text-arena-ink'
              )}
            >
              <Activity className="h-4 w-4" />
              Feed
            </Button>

            <Button onClick={handleAddTime} variant="ghost" className={hostCtrl}>
              <Clock className="h-4 w-4" /> +10s
            </Button>

            <Button onClick={handleTogglePause} variant="ghost" className={hostCtrl}>
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 fill-current" /> Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              )}
            </Button>

            <Button
              onClick={handleRevealAnswer}
              className="h-10 gap-1.5 rounded-none border-2 border-arena-signal bg-arena-signal px-5 font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-none hover:brightness-110"
            >
              Skip Question <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Activity Feed Panel (collapsible) */}
        {isActivityOpen && (
          <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l-2 border-white/15 bg-arena-stage/95 shadow-[8px_0_0_rgba(0,0,0,0.35)] animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/15 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
                <Activity className="h-4 w-4 text-arena-acid" /> Activity Feed
              </h3>
              <button type="button" onClick={() => setIsActivityOpen(false)} className="text-white/50 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {activityFeed.length === 0 ? (
                <p className="py-8 text-center text-xs text-white/50">No activity yet.</p>
              ) : (
                activityFeed.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 border border-white/15 bg-white/5 p-2.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${
                      entry.type === 'join' ? 'bg-arena-acid' :
                      entry.type === 'kick' ? 'bg-arena-signal' :
                      entry.type === 'answer' ? 'bg-[#4a2aff]' :
                      entry.type === 'multiplier' ? 'bg-arena-acid' :
                      entry.type === 'edit' ? 'bg-arena-court' :
                      entry.type === 'jump' ? 'bg-arena-signal' :
                      entry.type === 'announcement' ? 'bg-arena-acid' :
                      'bg-white/40'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs text-white/80 font-medium leading-snug">{entry.message}</p>
                      <p className="text-[9px] text-white/40 mt-0.5">
                        {entry.time.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </GameShell>
    );
  }

  // ==========================================
  // RENDER: QUESTION REVEAL STATE (BAR CHART)
  // ==========================================
  if (session.status === 'question_reveal') {
    if (!activeQuestion) return null;
    const totalVotes = revealData
      ? Object.values(revealData.optionCounts).reduce((a, b) => a + b, 0)
      : 0;
    const lesson = buildTeachableReveal(
      activeQuestion.answers,
      revealData?.optionCounts,
      activeQuestion.type
    );
    const copy = formatTeachableCopy(lesson, locale);
    const correctAnswers = activeQuestion.answers.filter((ans) => ans.is_correct);

    return (
      <GameShell>
        <div className="z-10 flex items-center justify-between gap-4">
          <LiveChip tone="acid">{t('answersRevealed')}</LiveChip>
          <div className="flex items-center gap-2">
            {quitControl}
            <BrandMark tone="light" size="sm" wordmark={false} />
          </div>
        </div>

        <div className="z-10 mx-auto my-4 max-w-4xl text-center">
          <p dir="auto" className="text-sm font-semibold text-white/50">{activeQuestion.prompt}</p>
          <h1 dir="auto" className="mt-3 font-display text-4xl font-extrabold leading-tight tracking-tight text-arena-acid sm:text-5xl">
            {copy.headline}
          </h1>
          {copy.subline && (
            <p dir="auto" className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">
              {copy.subline}
            </p>
          )}
          {correctAnswers.length > 0 && activeQuestion.type !== 'poll' && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {correctAnswers.map((ans) => (
                <div
                  key={ans.id}
                  className={`flex items-center gap-2 border-2 border-arena-acid px-4 py-2 text-base font-bold ${
                    answerUsesInk(ans.color) ? 'text-arena-ink' : 'text-white'
                  }`}
                  style={{ backgroundColor: resolveAnswerColor(ans.color) }}
                >
                  <AnswerSwatch shape={ans.shape} color={ans.color} className="h-8 w-8" markClassName="h-4 w-4" />
                  <span dir="auto">{ans.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 py-4">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.22em] text-white/50">
            {t('howTheRoomVoted')}
          </h3>

          <div className="flex h-64 w-full max-w-2xl items-end justify-center gap-6 border-b-2 border-white/15 px-6 pb-1 sm:h-80">
            {activeQuestion.answers.map((ans) => {
              const votes = revealData?.optionCounts[ans.id] || 0;
              const ratio = totalVotes > 0 ? votes / totalVotes : 0;
              const heightPercent = `${Math.max(5, ratio * 90)}%`;

              return (
                <div key={ans.id} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-sm font-black text-white">
                    {votes}
                  </span>
                  <div
                    className="relative flex w-full items-center justify-center shadow-[4px_0_0_rgba(0,0,0,0.25)] transition-all duration-500"
                    style={{
                      height: heightPercent,
                      backgroundColor: resolveAnswerColor(ans.color),
                    }}
                  >
                    {ans.is_correct && (
                      <CheckCircle2 className="absolute top-[-12px] h-6 w-6 border-2 border-arena-ink bg-arena-acid text-arena-ink" />
                    )}
                  </div>
                  <AnswerSwatch
                    shape={ans.shape}
                    color={ans.color}
                    className="h-8 w-8"
                    markClassName="h-4 w-4"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="z-10 mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs font-semibold text-white/50">
            PIN <bdi>{session.pin}</bdi>
          </span>
          <Button onClick={handleShowLeaderboard} className={hostCta}>
            Show Leaderboard <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </GameShell>
    );
  }

  // ==========================================
  // RENDER: LEADERBOARD STATE
  // ==========================================
  if (session.status === 'leaderboard') {
    const leaderboardPlayers = revealData?.leaderboard || players.slice(0, 5).sort((a, b) => b.score - a.score);
    const teamRows = teamMode ? aggregateTeamScores(players).slice(0, 5) : [];
    const fire = hottestStreak(players);

    return (
      <GameShell>
        <div className="z-10 flex items-center justify-between gap-4">
          <LiveChip tone="court">{t('scoreboard')}</LiveChip>
          <div className="flex items-center gap-2">
            {quitControl}
            <BrandMark tone="light" size="sm" wordmark={false} />
          </div>
        </div>

        <div className="z-10 my-4 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            {teamMode ? 'Team Leaderboard' : 'Leaderboard'}
          </h1>
          <p className="mt-1 text-xs text-white/50">
            {teamMode ? 'Combined team scores' : 'Top players this round'}
          </p>
          {fire ? (
            <p className="mt-3 inline-flex items-center gap-1.5 border-2 border-arena-acid bg-arena-acid px-3 py-1 font-display text-xs font-black uppercase tracking-[0.14em] text-arena-ink">
              <Flame className="h-3.5 w-3.5 fill-current" /> {t('onFire')} · {fire.nickname} · {fire.streak}
            </p>
          ) : null}
        </div>

        <div className="z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 py-6">
          {teamMode
            ? teamRows.map((team, rank) => {
                const maxScore = teamRows[0]?.score || 1;
                return (
                  <div
                    key={team.team_name}
                    className="border-2 border-white/15 bg-white/[0.05] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.25)]"
                  >
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-xl font-extrabold text-white">
                          <span className="mr-2 text-arena-acid">#{rank + 1}</span>
                          {team.team_name}
                        </p>
                        <p className="text-xs text-white/50">
                          {team.members} players · top: {team.topPlayer}
                        </p>
                      </div>
                      <span className="font-display text-2xl font-black tabular-nums text-arena-acid">
                        {team.score.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden bg-white/10">
                      <div
                        className="h-full bg-arena-acid transition-all duration-700"
                        style={{ width: `${scoreBarPercent(team.score, maxScore)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            : leaderboardPlayers.map((playerRecord, rank) => {
                const isTop3 = rank < 3;
                const maxScore = leaderboardPlayers[0]?.score || 1;
                return (
                  <div
                    key={playerRecord.id}
                    className={cn(
                      'border-2 bg-white/[0.05] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.25)]',
                      isTop3 ? 'border-arena-acid/50' : 'border-white/15'
                    )}
                  >
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`font-display text-lg font-extrabold ${
                            isTop3 ? 'text-arena-acid' : 'text-white/50'
                          }`}
                        >
                          #{rank + 1}
                        </span>
                        <span dir="auto" className="truncate font-extrabold text-lg text-white">
                          {playerRecord.nickname}
                        </span>
                        {playerRecord.streak > 1 && (
                          <span className="flex items-center gap-1 border-2 border-arena-acid bg-arena-acid px-2.5 py-0.5 text-xs font-extrabold text-arena-ink">
                            <Flame className="h-3.5 w-3.5 fill-current" /> {playerRecord.streak}
                          </span>
                        )}
                      </div>
                      <span className="font-display text-xl font-black tabular-nums text-arena-acid">
                        {playerRecord.score.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden bg-white/10">
                      <div
                        className={`h-full transition-all duration-700 ${isTop3 ? 'bg-arena-acid' : 'bg-white/40'}`}
                        style={{ width: `${scoreBarPercent(playerRecord.score, maxScore)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
        </div>

        <div className="z-10 mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs font-semibold text-white/50">
            PIN <bdi>{session.pin}</bdi>
          </span>
          {isLastQuestion ? (
            <Button onClick={handleShowPodium} className={hostCta}>
              Show Final Podium <Trophy className="h-4 w-4 text-arena-acid" />
            </Button>
          ) : (
            <Button onClick={handleNextQuestion} className={hostCta}>
              Next Question <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </GameShell>
    );
  }

  // ==========================================
  // RENDER: FINISHED STATE (PODIUM CELEBRATION)
  // ==========================================
  if (session.status === 'finished') {
    // Sort players to get winners
    const podiumWinners = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
    const firstPlace = podiumWinners[0];
    const secondPlace = podiumWinners[1];
    const thirdPlace = podiumWinners[2];

    return (
      <GameShell>
        <div className="z-10 flex items-center justify-between gap-4">
          <LiveChip tone="acid">Final standings</LiveChip>
          <BrandMark tone="light" size="sm" />
        </div>

        <div className="z-10 my-4 text-center">
          <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight text-white sm:text-5xl">
            Final <span className="text-arena-acid">podium</span>
          </h1>
          <p className="mt-2 text-xs text-white/50">
            Champions of <span dir="auto">{quiz.title}</span>
          </p>
        </div>

        <div className="z-10 mx-auto flex w-full max-w-3xl flex-1 items-end justify-center gap-4 py-12 sm:gap-6">
          {secondPlace && (
            <div className="flex w-1/4 min-w-[80px] flex-col items-center gap-3">
              <div className="w-full min-w-0 text-center">
                <span className="font-display text-sm font-bold text-white/50">2nd</span>
                <h3 className="mt-1 w-full truncate text-sm font-extrabold text-white sm:text-base">
                  {secondPlace.nickname}
                </h3>
                <span className="font-display text-xs font-bold tabular-nums text-arena-acid">
                  {secondPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="flex h-36 w-full flex-col items-center justify-center border-2 border-white/20 bg-[#4a2aff] shadow-[6px_6px_0_rgba(0,0,0,0.35)]">
                <span className="font-display text-4xl font-black text-white">2</span>
              </div>
            </div>
          )}

          {firstPlace && (
            <div className="z-10 flex w-1/3 min-w-[100px] flex-col items-center gap-3">
              <div className="flex w-full min-w-0 flex-col items-center text-center">
                <Trophy className="h-8 w-8 fill-arena-acid text-arena-acid" />
                <h3 className="mt-1.5 w-full truncate text-base font-black text-white sm:text-lg">
                  {firstPlace.nickname}
                </h3>
                <span className="font-display text-sm font-bold tabular-nums text-arena-acid">
                  {firstPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="relative flex h-48 w-full flex-col items-center justify-center border-2 border-arena-ink bg-arena-signal shadow-[8px_8px_0_rgba(200,245,66,0.35)]">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-arena-acid" />
                <span className="font-display text-5xl font-black text-white">1</span>
              </div>
            </div>
          )}

          {thirdPlace && (
            <div className="flex w-1/4 min-w-[80px] flex-col items-center gap-3">
              <div className="w-full min-w-0 text-center">
                <span className="font-display text-sm font-bold text-white/50">3rd</span>
                <h3 className="mt-1 w-full truncate text-sm font-extrabold text-white sm:text-base">
                  {thirdPlace.nickname}
                </h3>
                <span className="font-display text-xs font-bold tabular-nums text-arena-acid">
                  {thirdPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="flex h-24 w-full flex-col items-center justify-center border-2 border-white/20 bg-arena-court shadow-[6px_6px_0_rgba(0,0,0,0.35)]">
                <span className="font-display text-4xl font-black text-white">3</span>
              </div>
            </div>
          )}
        </div>

        <div className="z-10 mt-6 flex w-full flex-col items-center justify-center gap-3 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap">
          <Button
            onClick={() =>
              sharePodiumWhatsApp(podiumWinners.map((player) => ({ nickname: player.nickname, score: player.score })))
            }
            className={hostCta}
          >
            <MessageCircle className="h-4 w-4" /> {t('sharePodium')}
          </Button>
          <Button onClick={() => void copyPodiumLink()} className={hostCtrl}>
            <Link2 className="h-4 w-4" /> {t('copyLink')}
          </Button>
          <Button onClick={handleOpenReport} className={hostCtrl}>
            <ClipboardList className="h-4 w-4" /> {t('classReport')}
          </Button>
          <Button onClick={handlePlayAgain} className={hostCtrl}>
            <Play className="h-4 w-4 fill-current" /> Play again
          </Button>
          <Button onClick={handleCloseSession} className={hostCtrl}>
            <Home className="h-4 w-4" /> Dashboard
          </Button>
        </div>
      </GameShell>
    );
  }

  return null;
}
