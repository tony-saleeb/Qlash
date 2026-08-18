'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  addQuestionTime,
  goToLeaderboard,
  goToNextQuestion,
  goToPodium,
  pauseGameSession,
  revealQuestionResults,
  resumeGameSession,
  setLateJoinThroughIndex,
  startGameSession,
} from '@/app/actions/game';
import { ArrowRight, Clock, Monitor, Pause, Play, Trophy, Users } from 'lucide-react';
import { BrandMark, PinDisplay } from '@/components/brand/BrandMark';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import {
  buildQuestionStartPayload,
  type Player,
  type Question,
  type GameSessionRow,
} from '@/lib/game/types';
import { maybeSeededShuffle, questionsInPlayOrder } from '@/lib/game/shuffle';
import { remainingFromPausedElapsed, remainingSeconds } from '@/lib/game/clock';
import {
  DEFAULT_LATE_JOIN_THROUGH_INDEX,
  LATE_JOIN_LOBBY_ONLY,
  isLateJoinEnabled,
} from '@/lib/game/lateJoin';
import { waitingPlayers } from '@/lib/game/waitingPlayers';

interface HostClickerClientProps {
  initialSession: GameSessionRow;
  quiz: {
    id: string;
    title: string;
    randomize_questions?: boolean;
    randomize_answers?: boolean;
  };
  questions: Question[];
  initialPlayers: Player[];
}

function displayRemaining(session: GameSessionRow, question: Question | null, now: number): number {
  if (!question) return 0;
  if (session.status === 'question_paused') {
    return remainingFromPausedElapsed(session.question_started_at, question.time_limit_seconds);
  }
  return remainingSeconds(session.question_started_at, question.time_limit_seconds, now);
}

export default function HostClickerClient({
  initialSession,
  quiz,
  questions,
  initialPlayers,
}: HostClickerClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { send: sendSessionEvent } = useSessionChannel(initialSession.id, { supabase });

  const [session, setSession] = useState(initialSession);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const playersRef = useRef(players);
  playersRef.current = players;
  const [playQuestions, setPlayQuestions] = useState<Question[]>(() =>
    questionsInPlayOrder(questions, initialSession.question_order)
  );
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const revealingRef = useRef(false);

  const randomizeQuestions = Boolean(quiz.randomize_questions);
  const randomizeAnswers = Boolean(quiz.randomize_answers);

  const prepareQuestionForPlay = useCallback(
    (question: Question): Question => ({
      ...question,
      answers: maybeSeededShuffle(question.answers, randomizeAnswers, `${session.id}:${question.id}`),
    }),
    [randomizeAnswers, session.id]
  );

  const activeQuestion = playQuestions[session.current_question_index] || playQuestions[0] || null;
  const activeQuestionRef = useRef(activeQuestion);
  activeQuestionRef.current = activeQuestion;

  const waiting = useMemo(() => waitingPlayers(players, answeredIds), [players, answeredIds]);
  const lateJoinOn = isLateJoinEnabled(session.late_join_through_index);
  const remaining = displayRemaining(session, activeQuestion, clockNow);
  const orderKey = Array.isArray(session.question_order) ? session.question_order.join(',') : '';

  useEffect(() => {
    if (!orderKey) return;
    const ordered = questionsInPlayOrder(questions, session.question_order).map(prepareQuestionForPlay);
    setPlayQuestions(ordered);
  }, [questions, prepareQuestionForPlay, orderKey, session.question_order]);

  useEffect(() => {
    const questionId = activeQuestion?.id;
    if (!questionId) {
      setAnsweredIds(new Set());
      return;
    }
    let cancelled = false;
    setAnsweredIds(new Set());
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
    const channel = supabase
      .channel(`host_clicker_${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => (prev.find((p) => p.id === payload.new.id) ? prev : [...prev, payload.new as Player]));
          } else if (payload.eventType === 'DELETE') {
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setPlayers((prev) => prev.map((p) => (p.id === payload.new.id ? (payload.new as Player) : p)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          setSession(payload.new as GameSessionRow);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers_submitted', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const question = activeQuestionRef.current;
          if (!question || payload.new.question_id !== question.id) return;
          const playerId = payload.new.player_id as string;
          setAnsweredIds((prev) => {
            if (prev.has(playerId)) return prev;
            const next = new Set(prev);
            next.add(playerId);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, session.id]);

  useEffect(() => {
    if (session.status !== 'question_active') return;
    const id = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [session.status, session.question_started_at]);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the room.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleLateJoin = (enabled: boolean) => {
    const value = enabled ? DEFAULT_LATE_JOIN_THROUGH_INDEX : LATE_JOIN_LOBBY_ONLY;
    void run(async () => {
      const result = await setLateJoinThroughIndex(session.id, value);
      setSession((prev) => ({ ...prev, late_join_through_index: result.late_join_through_index }));
    });
  };

  const handleStart = () =>
    run(async () => {
      if (!questions.length) throw new Error('Add questions before starting.');
      if (players.length === 0) throw new Error('Wait for at least one player.');
      const ordered = maybeSeededShuffle(questions, randomizeQuestions, `${session.id}:order`).map(
        prepareQuestionForPlay
      );
      setPlayQuestions(ordered);
      const { serverStartedAt } = await startGameSession(
        session.id,
        ordered.map((q) => q.id)
      );
      revealingRef.current = false;
      void sendSessionEvent('question:start', buildQuestionStartPayload(ordered[0], 0, serverStartedAt));
    });

  const handlePauseResume = () =>
    run(async () => {
      if (session.status === 'question_paused') {
        const { serverStartedAt } = await resumeGameSession(session.id);
        void sendSessionEvent('timer:sync', {
          status: 'question_active',
          server_started_at: serverStartedAt,
          remaining_seconds: activeQuestion
            ? remainingSeconds(serverStartedAt, activeQuestion.time_limit_seconds)
            : remaining,
        });
      } else {
        await pauseGameSession(session.id);
        void sendSessionEvent('timer:sync', {
          status: 'question_paused',
          remaining_seconds: remaining,
        });
      }
    });

  const handleAddTime = () =>
    run(async () => {
      const { serverStartedAt } = await addQuestionTime(session.id, 10);
      void sendSessionEvent('timer:sync', {
        status: session.status,
        server_started_at: serverStartedAt,
        remaining_seconds: remaining + 10,
      });
    });

  const handleReveal = () =>
    run(async () => {
      if (revealingRef.current || !activeQuestion) return;
      revealingRef.current = true;
      try {
        const results = await revealQuestionResults(session.id, activeQuestion.id);
        const correctOptionIds = activeQuestion.answers.filter((ans) => ans.is_correct).map((ans) => ans.id);
        void sendSessionEvent('question:reveal', {
          correct_answer_ids: correctOptionIds,
          option_counts: results.optionCounts,
        });
      } finally {
        revealingRef.current = false;
      }
    });

  const handleLeaderboard = () => run(async () => { await goToLeaderboard(session.id); });

  const handleNext = () =>
    run(async () => {
      const nextIndex = session.current_question_index + 1;
      const nextQ = prepareQuestionForPlay(playQuestions[nextIndex]);
      const { serverStartedAt } = await goToNextQuestion(session.id, nextIndex);
      revealingRef.current = false;
      void sendSessionEvent('question:start', buildQuestionStartPayload(nextQ, nextIndex, serverStartedAt));
    });

  const handlePodium = () => run(async () => { await goToPodium(session.id); });

  const openStage = () => router.push(`/host/${session.id}`);

  const bigBtn =
    'h-16 w-full rounded-none font-display text-lg font-extrabold uppercase tracking-wide';

  return (
    <div className="flex min-h-dvh flex-col bg-arena-stage px-4 py-5 text-white">
      <header className="mb-5 flex items-center justify-between gap-3">
        <BrandMark tone="light" size="sm" />
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-none border-2 border-white/30 bg-white/10 px-3 text-xs font-bold uppercase tracking-wider text-white"
          onClick={openStage}
        >
          <Monitor className="mr-1.5 h-4 w-4" /> Projector
        </Button>
      </header>

      <p dir="auto" className="text-sm font-semibold text-white/55">
        {quiz.title}
      </p>
      <div className="mt-3 border-2 border-white bg-white p-3 text-center">
        <PinDisplay pin={session.pin} />
      </div>

      {session.status === 'lobby' && (
        <div className="mt-6 flex flex-1 flex-col gap-5">
          <p className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <Users className="h-6 w-6 text-arena-acid" /> {players.length} in lobby
          </p>
          <label className="flex items-center justify-between gap-3 border border-white/15 bg-white/5 p-4">
            <span>
              <span className="block text-sm font-bold">Late join through question 3</span>
              <span className="text-xs text-white/50">Kids who arrive after Start can still enter.</span>
            </span>
            <Switch
              checked={lateJoinOn}
              onCheckedChange={handleToggleLateJoin}
              className="data-checked:bg-arena-acid"
            />
          </label>
          <Button
            type="button"
            disabled={busy || players.length === 0 || questions.length === 0}
            onClick={handleStart}
            className={`${bigBtn} bg-arena-acid text-arena-ink`}
          >
            <Play className="mr-2 h-6 w-6 fill-current" /> Start
          </Button>
        </div>
      )}

      {(session.status === 'question_active' || session.status === 'question_paused') && activeQuestion && (
        <div className="mt-5 flex flex-1 flex-col gap-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
            Question {session.current_question_index + 1} of {playQuestions.length}
            {session.status === 'question_paused' ? ' · paused' : ''}
          </p>
          <p dir="auto" className="line-clamp-3 font-display text-xl font-extrabold">
            {activeQuestion.prompt}
          </p>
          <p className="font-display text-6xl font-extrabold tabular-nums text-arena-acid">{remaining}</p>
          <p className="text-sm font-bold text-white/70">
            {answeredIds.size}/{players.length} answered · {waiting.length} waiting
          </p>
          <ul className="max-h-40 flex-1 space-y-1 overflow-y-auto border border-white/10 bg-black/25 p-3">
            {waiting.length === 0 ? (
              <li className="text-sm text-white/50">Everyone in. Reveal when you are ready.</li>
            ) : (
              waiting.map((player) => (
                <li key={player.id} dir="auto" className="truncate text-sm font-bold">
                  {player.nickname}
                  {!player.connected ? <span className="ml-2 text-xs font-medium text-white/35">offline</span> : null}
                </li>
              ))
            )}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" disabled={busy} onClick={handleAddTime} className={`${bigBtn} bg-white/10`}>
              <Clock className="mr-1 h-5 w-5" /> +10s
            </Button>
            <Button type="button" disabled={busy} onClick={handlePauseResume} className={`${bigBtn} bg-white/10`}>
              {session.status === 'question_paused' ? (
                <>
                  <Play className="mr-1 h-5 w-5 fill-current" /> Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1 h-5 w-5" /> Pause
                </>
              )}
            </Button>
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={handleReveal}
            className={`${bigBtn} bg-arena-signal text-white`}
          >
            Reveal <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      )}

      {session.status === 'question_reveal' && (
        <div className="mt-8 flex flex-1 flex-col justify-end gap-3">
          <p className="font-display text-2xl font-extrabold">Answers are up on the projector.</p>
          <Button
            type="button"
            disabled={busy}
            onClick={handleLeaderboard}
            className={`${bigBtn} bg-arena-acid text-arena-ink`}
          >
            <Trophy className="mr-2 h-5 w-5" /> Leaderboard
          </Button>
        </div>
      )}

      {session.status === 'leaderboard' && (
        <div className="mt-8 flex flex-1 flex-col justify-end gap-3">
          {session.current_question_index < playQuestions.length - 1 ? (
            <Button
              type="button"
              disabled={busy}
              onClick={handleNext}
              className={`${bigBtn} bg-arena-acid text-arena-ink`}
            >
              Next question <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy}
              onClick={handlePodium}
              className={`${bigBtn} bg-arena-acid text-arena-ink`}
            >
              Podium
            </Button>
          )}
        </div>
      )}

      {session.status === 'finished' && (
        <div className="mt-8">
          <Button
            type="button"
            className={`${bigBtn} bg-arena-acid text-arena-ink`}
            onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
          >
            Class report
          </Button>
        </div>
      )}
    </div>
  );
}
