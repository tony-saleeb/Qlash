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
  endGameSession,
  setSessionMultiplier,
  startGameSession,
  pauseGameSession,
  resumeGameSession,
  addQuestionTime,
} from '@/app/actions/game';
import { Flame, Users, Play, Pause, UserX, AlertCircle, Trophy, ArrowRight, Home, CheckCircle2, Clock, Settings, Edit3, Zap, SkipForward, Send, Activity, ChevronDown, ChevronUp, MessageSquare, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { playJoinSound, playTickSound, playRevealSound, playFanfareSound } from '@/lib/sounds';
import { BrandMark, PinDisplay, StageBadge, playerChipColor } from '@/components/brand/BrandMark';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import {
  SHAPES_MAP,
  buildQuestionStartPayload,
  sanitizeAnswers,
  type Player,
  type LeaderboardPlayer,
  type Question,
  type GameSessionRow,
} from '@/lib/game/types';
import { maybeShuffle } from '@/lib/game/shuffle';
import { aggregateTeamScores } from '@/lib/game/teams';
import { MAX_PLAYERS_PER_SESSION } from '@/lib/game/constants';

interface HostGameClientProps {
  initialSession: GameSessionRow;
  quiz: {
    id: string;
    title: string;
    description: string;
    theme: Record<string, unknown>;
    randomize_questions?: boolean;
    randomize_answers?: boolean;
    team_mode?: boolean;
  };
  questions: Question[];
  initialPlayers: Player[];
}

export default function HostGameClient({
  initialSession,
  quiz,
  questions,
  initialPlayers,
}: HostGameClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { send: sendSessionEvent, ready: channelReady } = useSessionChannel(initialSession.id, { supabase });

  // Core game states
  const [session, setSession] = useState(initialSession);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const playersRef = useRef(players);
  playersRef.current = players;
  /** Session play order (may be shuffled once at start). */
  const [playQuestions, setPlayQuestions] = useState<Question[]>(questions);
  const randomizeQuestions = Boolean(quiz.randomize_questions);
  const randomizeAnswers = Boolean(quiz.randomize_answers);
  const teamMode = Boolean(quiz.team_mode);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [isManagePlayersOpen, setIsManagePlayersOpen] = useState(false);

  // Active question loop variables
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [submissionsCount, setSubmissionsCount] = useState<number>(0);
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

  // QR Code State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (session.status === 'lobby' && session.pin) {
      const joinUrl = `${window.location.origin}/play?pin=${session.pin}`;
      QRCode.toDataURL(
        joinUrl,
        {
          width: 256,
          margin: 2,
          color: {
            dark: '#0e1116',
            light: '#ffffff',
          },
        },
        (err, url) => {
          if (!err && url) {
            setQrDataUrl(url);
          } else if (err) {
            console.error('Failed to generate QR Code:', err);
          }
        }
      );
    }
  }, [session.status, session.pin]);

  const activeQuestionIndex = session.current_question_index;
  const activeQuestion = (playQuestions && playQuestions.length > 0)
    ? (playQuestions[activeQuestionIndex] || playQuestions[0])
    : null;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const revealingRef = useRef(false);

  const shapesMap = SHAPES_MAP;

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

      const broadcast = await sendSessionEvent('question:reveal', {
        correct_answer_ids: correctOptionIds,
        leaderboard: results.leaderboard,
        option_counts: results.optionCounts,
      });

      if (!broadcast.ok) {
        toast.warning('Scores saved, but some players may need to refresh for results.', {
          id: loadingToast,
        });
      } else {
        toast.success('Results calculated!', { id: loadingToast });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reveal results.', { id: loadingToast });
    } finally {
      revealingRef.current = false;
    }
  }, [session.id, activeQuestion, sendSessionEvent]);

  // 1. Setup Realtime Player database synchronizer (stable deps — use playersRef)
  useEffect(() => {
    const channel = supabase
      .channel(`host_players_${session.id}`)
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
            setPlayers((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Player) : p))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, session.id, addActivityEntry]);

  // 2. Setup Realtime Session database updates synchronizer
  useEffect(() => {
    const channel = supabase
      .channel(`host_session_${session.id}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, session.id]);

  // 3. Listen to Submissions count dynamically during question_active
  useEffect(() => {
    if (session.status !== 'question_active') {
      setSubmissionsCount(0);
      return;
    }

    const loadInitialSubmissions = async () => {
      if (!activeQuestion) return;
      const { count } = await supabase
        .from('answers_submitted')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('question_id', activeQuestion.id);
      setSubmissionsCount(count || 0);
    };
    loadInitialSubmissions();

    const channel = supabase
      .channel(`host_submissions_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answers_submitted',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          if (activeQuestion && payload.new.question_id === activeQuestion.id) {
            setSubmissionsCount((prev) => prev + 1);
            const answerer = playersRef.current.find((p) => p.id === payload.new.player_id);
            if (answerer) addActivityEntry('answer', `${answerer.nickname} submitted an answer`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, session.id, session.status, activeQuestion, addActivityEntry]);

  // 4. Timer Tick-down thread logic
  useEffect(() => {
    if (session.status !== 'question_active' || !session.question_started_at || !activeQuestion) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);

      const timeLimit = activeQuestion.time_limit_seconds;
      const startedAt = new Date(session.question_started_at!).getTime();

      const updateTimer = () => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
        setTimeLeft(remaining);

        if (remaining <= 5 && remaining > 0) {
          playTickSound();
        }

        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleRevealAnswer();
        }
      };

      updateTimer(); // run once immediately
      timerRef.current = setInterval(updateTimer, 1000);
    };

    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session.status, session.question_started_at, activeQuestion, handleRevealAnswer]);

  // 5. Confetti trigger for podium finish
  useEffect(() => {
    if (session.status === 'finished') {
      playFanfareSound();
      // Fire confetti bursts!
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
        await resumeGameSession(session.id);
        toast.success('Game resumed!');
      } else {
        await pauseGameSession(session.id);
        toast.success('Game paused!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle pause.');
    }
  };

  // Add +10 seconds to the clock
  const handleAddTime = async () => {
    if (!session.question_started_at) return;
    try {
      await addQuestionTime(session.id, 10);
      setTimeLeft((prev) => prev + 10);
      toast.success('Added 10 seconds to the clock!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add time.');
    }
  };

  const prepareQuestionForPlay = useCallback(
    (question: Question): Question => {
      if (!randomizeAnswers) return question;
      return {
        ...question,
        answers: maybeShuffle(question.answers, true),
      };
    },
    [randomizeAnswers]
  );

  // Start Game
  const handleStartGame = async () => {
    if (!questions || questions.length === 0) {
      toast.error('You cannot start a game with 0 questions.');
      return;
    }
    if (players.length === 0) {
      toast.error('You cannot start a game with 0 players.');
      return;
    }

    try {
      if (!channelReady) {
        // Brief wait so first broadcast isn't dropped before subscribe completes
        await new Promise((r) => setTimeout(r, 300));
      }

      const ordered = maybeShuffle(questions, randomizeQuestions).map(prepareQuestionForPlay);
      setPlayQuestions(ordered);

      const { serverStartedAt } = await startGameSession(
        session.id,
        ordered.map((q) => q.id)
      );
      setIsMultiplierActive(false);
      revealingRef.current = false;

      const firstQ = ordered[0];
      const broadcast = await sendSessionEvent(
        'question:start',
        buildQuestionStartPayload(firstQ, 0, serverStartedAt)
      );

      if (!broadcast.ok) {
        toast.warning('Game started — if players miss the question, ask them to refresh.');
      } else {
        toast.success(
          randomizeQuestions
            ? 'Game started! Question order randomized.'
            : 'Game started! Broadcasting first question.'
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start game.');
    }
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

      await sendSessionEvent('question:start', buildQuestionStartPayload(nextQ, nextIndex, serverStartedAt));

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

      await sendSessionEvent(
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

  const connectedCount = players.filter((p) => p.connected).length;
  const isLastQuestion = activeQuestionIndex === playQuestions.length - 1;

  // BACKGROUND THEME STYLE EXTRACTOR
  const customStyles = {
    backgroundColor: (quiz.theme?.bgColor as string) || '#12151c',
    color: (quiz.theme?.textColor as string) || '#f4f6f8',
  };

  // ==========================================
  // RENDER: LOBBY STATE
  // ==========================================
  if (session.status === 'lobby') {
    return (
      <div className="arena-stage arena-noise relative flex min-h-screen w-full flex-col justify-between overflow-hidden font-sans">
        <div className="pointer-events-none absolute inset-0 arena-grid opacity-[0.18]" />
        <div className="pointer-events-none absolute -right-16 top-16 h-48 w-48 rotate-[14deg] bg-arena-acid motion-breathe" />
        <div className="pointer-events-none absolute bottom-28 -left-6 h-24 w-24 -rotate-6 bg-arena-signal" />
        <div className="pointer-events-none absolute bottom-16 left-24 h-10 w-40 bg-arena-court" />

        <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-4">
            <BrandMark tone="light" size="sm" />
            <div className="hidden border-l border-white/15 pl-4 sm:block">
              <p className="font-display text-sm font-bold text-white">{quiz.title}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Live lobby</p>
            </div>
          </div>
          <StageBadge className="motion-pulse-soft">
            <Users className="h-3.5 w-3.5" />
            {connectedCount}/{players.length} · max {MAX_PLAYERS_PER_SESSION}
          </StageBadge>
        </header>

        <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-12">
          <div className="flex flex-col justify-center gap-8 text-center lg:col-span-5 lg:text-left">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-arena-acid">Join on your phone</p>
              <h2 className="mt-3 font-display text-5xl font-extrabold leading-[0.9] tracking-[-0.03em] text-white sm:text-6xl">
                Enter
                <span className="mt-1 block text-arena-acid">the PIN</span>
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-sm font-medium text-white/50 lg:mx-0">
                Open QuizArena → Player. No accounts. Instant board presence.
              </p>
            </div>

            <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 sm:flex-row lg:mx-0">
              <div className="w-full flex-1 border-2 border-arena-ink bg-white p-5 text-center shadow-[8px_8px_0_rgba(0,0,0,0.35)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-arena-ink/40">Room PIN</p>
                <div className="mt-3">
                  <PinDisplay pin={session.pin} large />
                </div>
              </div>
              {qrDataUrl && (
                <div className="flex h-44 w-44 shrink-0 flex-col items-center justify-center border-2 border-arena-acid bg-white p-3 shadow-[6px_6px_0_rgba(200,245,66,0.35)]">
                  <img src={qrDataUrl} alt="Lobby QR Code" className="h-32 w-32" />
                  <span className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-arena-ink/45">Scan</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[48vh] flex-col gap-4 self-stretch border border-white/12 bg-white/[0.04] p-6 backdrop-blur-[2px] lg:col-span-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/55">
                <Users className="h-4 w-4 text-arena-acid" /> Players
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
                <div className="mb-4 h-1.5 w-28 overflow-hidden bg-white/10">
                  <div className="h-full w-1/2 animate-pulse bg-arena-acid" />
                </div>
                <p className="font-display text-xl font-bold text-white">Waiting for players…</p>
                <p className="mt-2 max-w-xs text-xs text-white/40">
                  Nicknames land here the second someone joins.
                </p>
              </div>
            ) : (
              <div className="max-h-[52vh] flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className={`group relative flex items-center gap-2.5 border px-3 py-2.5 transition ${
                        p.connected
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
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.nickname}</span>
                      <button
                        type="button"
                        disabled={!!kickingId}
                        onClick={() => handleKickPlayer(p.id, p.nickname)}
                        className="shrink-0 text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-arena-signal"
                        title="Kick Player"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                      {!p.connected && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-arena-signal" title="Offline" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 bg-black/20 px-6 py-5 sm:flex-row">
          <p className="text-center text-xs uppercase tracking-[0.14em] text-white/40 sm:text-left">
            Keep this screen visible · PIN <strong className="text-white">{session.pin}</strong>
          </p>
          <Button
            onClick={handleStartGame}
            disabled={players.length === 0 || !questions || questions.length === 0}
            className="h-14 w-full rounded-none bg-arena-acid px-10 font-display text-lg font-extrabold text-arena-ink shadow-[6px_6px_0_rgba(200,245,66,0.25)] hover:brightness-105 sm:w-auto"
          >
            <Play className="mr-2 h-5 w-5 fill-current" /> Start game
          </Button>
        </footer>
      </div>
    );
  }


  // ==========================================
  // RENDER: ACTIVE QUESTION STATE (TIMER COUNTDOWN)
  // ==========================================
  if (session.status === 'question_active' || session.status === 'question_paused') {
    if (!activeQuestion) return null;
    return (
      <div
        className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden font-sans p-6"
        style={customStyles}
      >
        {/* Title bar / Index + Question Jumper */}
        <div className="flex items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black bg-arena-signal px-3 py-1.5 rounded-xl uppercase tracking-wider text-white">
              Question {activeQuestionIndex + 1} of {playQuestions.length}
            </span>

            {/* Question Jumper Dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setIsJumperOpen(!isJumperOpen)}
                className="border-white/15 hover:bg-white/10 text-white/80 gap-1 h-8 rounded-lg text-[10px] px-2.5"
              >
                <SkipForward className="w-3.5 h-3.5 text-arena-acid" />
                Jump
                {isJumperOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
              {isJumperOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 max-h-60 overflow-y-auto bg-arena-stage border border-white/15 rounded-xl shadow-2xl z-50 p-1.5 animate-fade-in">
                  {playQuestions.map((q, idx) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleJumpToQuestion(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        idx === activeQuestionIndex
                          ? 'bg-arena-signal text-white cursor-default'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="font-black">Q{idx + 1}</span>{' '}
                      <span className="text-white/60 truncate">{q.prompt.slice(0, 30)}{q.prompt.length > 30 ? '...' : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Multiplier Badge */}
            {isMultiplierActive && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-arena-ink text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                <Zap className="w-3 h-3" /> 2x Points
              </span>
            )}
          </div>
          <span className="text-white/60 font-semibold text-xs">
            QuizArena Live Game
          </span>
        </div>

        {/* Prompt Question */}
        <div className="my-6 text-center max-w-4xl mx-auto z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
            {activeQuestion.prompt}
          </h1>
        </div>

        {/* Active Question Workspace (Timer / Submissions count / Media) */}
        <div className="grid md:grid-cols-12 gap-8 items-center justify-center flex-1 max-w-5xl mx-auto w-full z-10">
          {/* Left: Timer */}
          <div className="md:col-span-3 flex flex-col items-center justify-center text-center order-2 md:order-1">
            <div className={`w-32 h-32 rounded-full border-8 ${session.status === 'question_paused' ? 'border-amber-500/40 animate-pulse' : 'border-arena-acid/20'} flex flex-col items-center justify-center bg-arena-stage/60 shadow-2xl relative`}>
              <span className={`text-4xl font-black ${timeLeft <= 5 && session.status !== 'question_paused' ? 'text-rose-500 animate-ping' : 'text-white'}`}>
                {timeLeft}
              </span>
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
                {session.status === 'question_paused' ? 'Paused' : 'Seconds'}
              </span>
            </div>
          </div>

          {/* Center: Image / Video Media */}
          <div className="md:col-span-6 flex justify-center items-center h-64 sm:h-80 w-full order-1 md:order-2">
            {activeQuestion.media_url ? (
              activeQuestion.media_type === 'video' ? (
                <video
                  src={activeQuestion.media_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="max-h-full max-w-full rounded-2xl shadow-2xl object-contain border border-white/15"
                />
              ) : (
                <img
                  // eslint-disable-next-line @next/next/no-img-element
                  src={activeQuestion.media_url}
                  alt="Question Media"
                  className="max-h-full max-w-full rounded-2xl shadow-2xl object-contain border border-white/15"
                />
              )
            ) : (
              // Decorative animated icon placeholder if no media
              <div className="p-8 bg-white/5 border border-white/15 rounded-3xl w-full h-full flex flex-col items-center justify-center text-center">
                <Flame className="w-16 h-16 text-arena-acid/40 animate-pulse mb-3" />
                <span className="text-xs text-white/50 font-bold uppercase tracking-wider">
                  QuizArena Showdown
                </span>
              </div>
            )}
          </div>

          {/* Right: Submissions counter */}
          <div className="md:col-span-3 flex flex-col items-center justify-center text-center order-3">
            <div className="w-32 h-32 rounded-full border-8 border-emerald-500/20 flex flex-col items-center justify-center bg-arena-stage/60 shadow-2xl">
              <span className="text-4xl font-black text-emerald-400">
                {submissionsCount}
              </span>
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
                Answers
              </span>
            </div>
            <span className="text-xs text-white/60 mt-2 font-medium">
              out of {players.length} players
            </span>
          </div>
        </div>

        {/* Answers Grid layout */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-5xl w-full mx-auto mt-6 z-10">
          {activeQuestion.answers.map((ans) => (
            <div
              key={ans.id}
              className="flex items-center gap-3.5 border border-white/10 p-4 rounded-2xl select-none shadow-lg text-white font-bold transition-all text-lg"
              style={{ backgroundColor: ans.color }}
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-black">
                {shapesMap[ans.shape] || '■'}
              </div>
              <span className="truncate">{ans.text}</span>
            </div>
          ))}
        </div>

        {/* Host controls footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6 z-10 flex-wrap gap-2">
          <span className="text-white/50 text-xs font-semibold">
            PIN: {session.pin} | Live submissions tracking
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Manage Players Dialog */}
            <Dialog open={isManagePlayersOpen} onOpenChange={setIsManagePlayersOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" className="border-white/15 hover:bg-white/10 text-white/80 gap-1.5 h-10 rounded-xl text-xs">
                    <Settings className="w-4 h-4 text-arena-acid" /> Players ({players.length})
                  </Button>
                }
              />
              <DialogContent className="bg-arena-stage border-white/10 text-white max-w-md rounded-2xl shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                    <Users className="w-5 h-5 text-arena-acid" /> Manage Session Players
                  </DialogTitle>
                  <DialogDescription className="text-white/50 text-xs">
                    Kick players who are idle, names are inappropriate, or who have disconnected.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[50vh] overflow-y-auto space-y-2 mt-4 pr-1">
                  {players.length === 0 ? (
                    <p className="text-white/50 text-sm text-center py-4">No players joined yet.</p>
                  ) : (
                    players.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/10 border border-white/15">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          <span className="font-bold text-sm truncate max-w-[180px]">{p.nickname}</span>
                          <span className="text-[10px] text-white/50">({p.score} pts)</span>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!!kickingId}
                          onClick={() => handleKickPlayer(p.id, p.nickname)}
                          className="h-8 rounded-lg text-xs bg-rose-600 hover:bg-rose-500 text-white px-3 flex items-center gap-1 font-bold"
                        >
                          <UserX className="w-3.5 h-3.5" /> Kick
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
                  <Button variant="outline" onClick={handleOpenEditor} className="border-white/15 hover:bg-white/10 text-white/80 gap-1.5 h-10 rounded-xl text-xs">
                    <Edit3 className="w-4 h-4 text-arena-acid" /> Edit
                  </Button>
                }
              />
              <DialogContent className="bg-arena-stage border-white/10 text-white max-w-lg rounded-2xl shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                    <Edit3 className="w-5 h-5 text-arena-acid" /> Live Question Editor
                  </DialogTitle>
                  <DialogDescription className="text-white/50 text-xs">
                    Edit the current question prompt and answers live. Changes broadcast instantly to all players.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-white/60 font-extrabold text-[10px] uppercase tracking-wider">Question Prompt</label>
                    <Textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      className="bg-white/10 border-white/15 text-white rounded-xl min-h-[80px] focus-visible:ring-fuchsia-500"
                      placeholder="Enter the question..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-white/60 font-extrabold text-[10px] uppercase tracking-wider">Answer Options</label>
                    {editAnswers.map((ans, idx) => (
                      <div key={ans.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-white/50 w-5">{idx + 1}.</span>
                        <Input
                          value={ans.text}
                          onChange={(e) => {
                            const updated = [...editAnswers];
                            updated[idx] = { ...updated[idx], text: e.target.value };
                            setEditAnswers(updated);
                          }}
                          className="bg-white/10 border-white/15 text-white rounded-lg h-9 text-sm focus-visible:ring-fuchsia-500"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleSaveQuestionEdit}
                    className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold h-10 rounded-xl text-sm shadow-lg"
                  >
                    Save & Broadcast Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Multiplier Toggle */}
            <Button
              onClick={handleToggleMultiplier}
              variant="outline"
              className={`gap-1.5 h-10 rounded-xl text-xs font-bold transition-all ${
                isMultiplierActive
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  : 'border-white/15 hover:bg-white/10 text-slate-350'
              }`}
            >
              <Zap className={`w-4 h-4 ${isMultiplierActive ? 'text-amber-400 fill-amber-400' : 'text-white/50'}`} />
              {isMultiplierActive ? '2x ON' : '2x'}
            </Button>

            {/* Host Announcement */}
            <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" className="border-white/15 hover:bg-white/10 text-white/80 gap-1.5 h-10 rounded-xl text-xs">
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                  </Button>
                }
              />
              <DialogContent className="bg-arena-stage border-white/10 text-white max-w-sm rounded-2xl shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <MessageSquare className="w-5 h-5 text-sky-500" /> Broadcast Announcement
                  </DialogTitle>
                  <DialogDescription className="text-white/50 text-xs">
                    Send a message to all player screens instantly.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-3">
                  <Input
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Type your message..."
                    maxLength={120}
                    className="bg-white/10 border-white/15 text-white rounded-xl h-11 focus-visible:ring-sky-500"
                  />
                  <Button
                    onClick={handleSendAnnouncement}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold h-10 rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Send to All Players
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Activity Feed Toggle */}
            <Button
              onClick={() => setIsActivityOpen(!isActivityOpen)}
              variant="outline"
              className={`gap-1.5 h-10 rounded-xl text-xs ${isActivityOpen ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/15 hover:bg-white/10 text-white/80'}`}
            >
              <Activity className={`w-4 h-4 ${isActivityOpen ? 'text-emerald-400' : 'text-white/50'}`} />
              Feed
            </Button>

            {/* Add Time Button */}
            <Button
              onClick={handleAddTime}
              variant="outline"
              className="border-white/15 hover:bg-white/10 text-slate-350 gap-1.5 h-10 rounded-xl text-xs"
            >
              <Clock className="w-4 h-4 text-emerald-400" /> +10s
            </Button>

            {/* Pause / Resume Button */}
            <Button
              onClick={handleTogglePause}
              variant="outline"
              className="border-white/15 hover:bg-white/10 text-slate-350 gap-1.5 h-10 rounded-xl text-xs"
            >
              {session.status === 'question_paused' ? (
                <>
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400/20" /> Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 text-amber-400 fill-amber-400/20" /> Pause
                </>
              )}
            </Button>

            {/* Skip Button */}
            <Button
              onClick={handleRevealAnswer}
              className="bg-arena-signal hover:bg-arena-signal/90 font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-black/10 flex items-center gap-1.5 text-white"
            >
              Skip Question <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Activity Feed Panel (collapsible) */}
        {isActivityOpen && (
          <div className="fixed top-0 right-0 h-full w-80 bg-arena-stage/95 border-l border-white/15 backdrop-blur-xl z-50 flex flex-col shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-white/15">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" /> Activity Feed
              </h3>
              <button type="button" onClick={() => setIsActivityOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activityFeed.length === 0 ? (
                <p className="text-white/50 text-xs text-center py-8">No activity yet.</p>
              ) : (
                activityFeed.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 p-2.5 bg-white/5 border border-white/15 rounded-xl">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      entry.type === 'join' ? 'bg-emerald-500' :
                      entry.type === 'kick' ? 'bg-rose-500' :
                      entry.type === 'answer' ? 'bg-sky-500' :
                      entry.type === 'multiplier' ? 'bg-amber-500' :
                      entry.type === 'edit' ? 'bg-fuchsia-500' :
                      entry.type === 'jump' ? 'bg-arena-signal' :
                      entry.type === 'announcement' ? 'bg-sky-500' :
                      'bg-slate-500'
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
      </div>
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

    return (
      <div
        className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden font-sans p-6"
        style={customStyles}
      >
        <div className="flex items-center justify-between gap-4 z-10">
          <span className="text-sm font-black bg-emerald-600 px-3 py-1.5 rounded-xl uppercase tracking-wider text-white">
            Answers Revealed
          </span>
          <span className="text-white/60 font-semibold text-xs">
            QuizArena Live Game
          </span>
        </div>

        <div className="my-6 text-center max-w-4xl mx-auto z-10">
          <h1 className="text-3xl font-black leading-tight text-white">
            {activeQuestion.prompt}
          </h1>
        </div>

        {/* Chart View */}
        <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col items-center justify-center gap-8 z-10 py-6">
          <h3 className="text-xs uppercase font-extrabold tracking-widest text-white/50">
            Player Answer Choices Distribution
          </h3>

          {/* Vertical Bar Chart */}
          <div className="flex items-end justify-center gap-6 h-64 sm:h-80 w-full max-w-2xl px-6 border-b border-white/10 pb-1">
            {activeQuestion.answers.map((ans) => {
              const votes = revealData?.optionCounts[ans.id] || 0;
              const ratio = totalVotes > 0 ? votes / totalVotes : 0;
              const heightPercent = `${Math.max(5, ratio * 90)}%`; // minimum 5% height to show empty bars

              return (
                <div key={ans.id} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="font-mono text-sm font-black text-white bg-white/10 px-2 py-0.5 rounded border border-white/15">
                    {votes}
                  </span>
                  <div
                    className="w-full rounded-t-xl transition-all duration-500 shadow-lg relative flex items-center justify-center"
                    style={{
                      height: heightPercent,
                      backgroundColor: ans.color,
                    }}
                  >
                    {/* Visual checkmark inside correct choice bars */}
                    {ans.is_correct && (
                      <CheckCircle2 className="w-6 h-6 text-white bg-emerald-500 rounded-full border-2 border-white absolute top-[-12px]" />
                    )}
                  </div>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
                    style={{ backgroundColor: ans.color }}
                  >
                    {shapesMap[ans.shape] || '■'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Choices grid highlighting correct answer */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-5xl w-full mx-auto mt-6 z-10">
          {activeQuestion.answers.map((ans) => {
            const isCorrect = ans.is_correct;
            return (
              <div
                key={ans.id}
                className={`flex items-center gap-3.5 border p-4 rounded-2xl select-none shadow-lg text-white font-bold text-lg transition-all ${
                  isCorrect
                    ? 'border-emerald-500 ring-4 ring-emerald-500/20 scale-100'
                    : 'opacity-30 border-white/10'
                }`}
                style={{ backgroundColor: ans.color }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-black">
                  {shapesMap[ans.shape] || '■'}
                </div>
                <span className="truncate flex-1">{ans.text}</span>
                {isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-300" />}
              </div>
            );
          })}
        </div>

        {/* Reveal controls footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6 z-10">
          <span className="text-white/50 text-xs font-semibold">
            Room PIN: {session.pin}
          </span>
          <Button
            onClick={handleShowLeaderboard}
            className="bg-arena-signal hover:bg-arena-signal/90 font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-black/10 flex items-center gap-1.5 text-white"
          >
            Show Leaderboard <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LEADERBOARD STATE
  // ==========================================
  if (session.status === 'leaderboard') {
    const leaderboardPlayers = revealData?.leaderboard || players.slice(0, 5).sort((a, b) => b.score - a.score);
    const teamRows = teamMode ? aggregateTeamScores(players).slice(0, 5) : [];

    return (
      <div
        className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden font-sans p-6"
        style={customStyles}
      >
        <div className="flex items-center justify-between gap-4 z-10">
          <span className="text-sm font-black bg-arena-court px-3 py-1.5 rounded-xl uppercase tracking-wider text-white">
            Scoreboard
          </span>
          <span className="text-white/60 font-semibold text-xs">
            QuizArena Live Game
          </span>
        </div>

        <div className="my-4 text-center z-10">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            {teamMode ? 'Team Leaderboard' : 'Leaderboard'}
          </h1>
          <p className="text-white/50 text-xs mt-1">
            {teamMode ? 'Combined team scores' : 'Top players for this round'}
          </p>
        </div>

        {/* Scoreboard List */}
        <div className="flex-1 max-w-xl mx-auto w-full flex flex-col justify-center gap-4 z-10 py-6">
          {teamMode
            ? teamRows.map((team, rank) => (
                <div
                  key={team.team_name}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/15 rounded-2xl shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-black text-white/60">#{rank + 1}</span>
                    <div>
                      <p className="font-bold text-white">{team.team_name}</p>
                      <p className="text-xs text-white/50">
                        {team.members} players · top: {team.topPlayer}
                      </p>
                    </div>
                  </div>
                  <span className="font-black text-arena-acid">{team.score}</span>
                </div>
              ))
            : leaderboardPlayers.map((playerRecord, rank) => {
            const isTop3 = rank < 3;

            return (
              <div
                key={playerRecord.id}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/15 rounded-2xl shadow-xl hover:border-white/25 transition-colors duration-300"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`w-8 text-center font-display text-lg font-extrabold ${
                      isTop3 ? 'text-arena-acid' : 'text-white/50'
                    }`}
                  >
                    {rank + 1}
                  </span>
                  <span className="font-extrabold text-lg text-white truncate max-w-[200px] sm:max-w-xs">
                    {playerRecord.nickname}
                  </span>
                  {playerRecord.streak > 1 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-950/20 text-amber-500 font-extrabold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-current" /> {playerRecord.streak}
                    </span>
                  )}
                </div>
                <span className="font-black text-xl text-arena-acid font-mono">
                  {playerRecord.score.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Leaderboard navigation footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6 z-10">
          <span className="text-white/50 text-xs font-semibold">
            Room PIN: {session.pin}
          </span>
          {isLastQuestion ? (
            <Button
              onClick={handleShowPodium}
              className="bg-gradient-to-r from-arena-signal to-[#c21828] hover:brightness-110 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-black/10 flex items-center gap-1.5"
            >
              Show Final Podium <Trophy className="w-4 h-4 text-amber-300" />
            </Button>
          ) : (
            <Button
              onClick={handleNextQuestion}
              className="bg-arena-signal hover:bg-arena-signal/90 font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-black/10 flex items-center gap-1.5 text-white"
            >
              Next Question <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
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
      <div
        className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden font-sans p-6 bg-arena-stage"
      >
        {/* Glow */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-transparent blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-transparent blur-[150px] pointer-events-none" />

        <div className="flex items-center justify-between gap-4 z-10">
          <span className="text-sm font-black bg-amber-600 px-3 py-1.5 rounded-xl uppercase tracking-wider text-white">
            Final Standings
          </span>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
            <span className="text-white/60 font-bold text-sm">Game Over</span>
          </div>
        </div>

        <div className="my-4 text-center z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-arena-acid tracking-tight leading-none font-display">
            Final podium
          </h1>
          <p className="text-white/50 text-xs mt-2">
            Celebrating the champions of {quiz.title}!
          </p>
        </div>

        {/* 3D Podium Layout */}
        <div className="flex-1 max-w-3xl mx-auto w-full flex items-end justify-center gap-4 sm:gap-6 z-10 py-12">
          {/* 2nd Place Block (Left) */}
          {secondPlace && (
            <div className="flex flex-col items-center gap-3 w-1/4 min-w-[80px]">
              <div className="text-center w-full min-w-0">
                <span className="font-display text-sm font-bold text-white/50">2nd</span>
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate w-full mt-1">
                  {secondPlace.nickname}
                </h3>
                <span className="font-mono text-xs text-arena-acid font-bold">
                  {secondPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/10 border-x border-t border-white/15 rounded-t-2xl w-full h-36 flex flex-col items-center justify-center shadow-xl">
                <span className="font-black text-4xl text-white/50">2</span>
              </div>
            </div>
          )}

          {/* 1st Place Block (Center - Highest) */}
          {firstPlace && (
            <div className="flex flex-col items-center gap-3 w-1/3 min-w-[100px] z-10">
              <div className="text-center w-full min-w-0 flex flex-col items-center">
                <Trophy className="w-8 h-8 text-amber-400 fill-amber-400 animate-pulse" />
                <h3 className="font-black text-base sm:text-lg text-white truncate w-full mt-1.5">
                  {firstPlace.nickname}
                </h3>
                <span className="font-mono text-sm text-arena-acid font-bold">
                  {firstPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/10/90 border-x border-t border-white/25/60 rounded-t-2xl w-full h-48 flex flex-col items-center justify-center shadow-2xl relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 rounded-t-full" />
                <span className="font-black text-5xl text-amber-500">1</span>
              </div>
            </div>
          )}

          {/* 3rd Place Block (Right) */}
          {thirdPlace && (
            <div className="flex flex-col items-center gap-3 w-1/4 min-w-[80px]">
              <div className="text-center w-full min-w-0">
                <span className="font-display text-sm font-bold text-white/50">3rd</span>
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate w-full mt-1">
                  {thirdPlace.nickname}
                </h3>
                <span className="font-mono text-xs text-arena-acid font-bold">
                  {thirdPlace.score.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/10 border-x border-t border-white/15 rounded-t-2xl w-full h-24 flex flex-col items-center justify-center shadow-xl">
                <span className="font-black text-4xl text-amber-700">3</span>
              </div>
            </div>
          )}
        </div>

        {/* Podium exit footer */}
        <div className="flex items-center justify-center border-t border-white/10 pt-4 mt-6 z-10 w-full">
          <Button
            onClick={handleCloseSession}
            className="bg-white/10 hover:bg-slate-800 border border-white/15 font-bold rounded-xl text-xs h-12 px-6 flex items-center gap-2 text-white"
          >
            <Home className="w-4 h-4 text-arena-acid" /> Return to Host Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
