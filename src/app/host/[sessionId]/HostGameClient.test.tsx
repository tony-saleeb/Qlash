/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { HOST_REVEAL_DELAY_MS } from '@/lib/game/constants';
import type { GameSessionRow, Player, Question } from '@/lib/game/types';

const supabase = createClientMock();
const hostApi = vi.hoisted(() => ({
  kickPlayer: vi.fn(async () => ({})),
  revealQuestionResults: vi.fn(async () => ({ optionCounts: {}, leaderboard: [] })),
  goToLeaderboard: vi.fn(async () => ({})),
  goToNextQuestion: vi.fn(async () => ({ success: true as const, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  goToPodium: vi.fn(async () => ({})),
  endGameSession: vi.fn(async () => ({})),
  setSessionMultiplier: vi.fn(async () => ({})),
  startGameSession: vi.fn(async () => ({ success: true as const, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  pauseGameSession: vi.fn(async () => ({})),
  resumeGameSession: vi.fn(async () => ({ success: true as const, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  addQuestionTime: vi.fn(async () => ({ success: true as const, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  setHostLocale: vi.fn(async () => ({})),
  setJoinLocked: vi.fn(async () => ({ join_locked: false })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/hooks/useSessionChannel', () => ({
  useSessionChannel: () => ({ send: vi.fn(), ready: true, connection: 1 }),
}));

vi.mock('@/lib/host/hostApi', () => hostApi);

vi.mock('@/lib/sounds', () => ({
  bindAudioUnlock: () => () => undefined,
  playJoinSound: vi.fn(),
  playTickSound: vi.fn(),
  playRevealSound: vi.fn(),
  playFanfareSound: vi.fn(),
  unlockGameAudio: vi.fn(async () => true),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'toast'), message: vi.fn() },
}));

import HostGameClient from '@/app/host/[sessionId]/HostGameClient';

function question(id: string, prompt: string): Question {
  return {
    id,
    type: 'mcq',
    prompt,
    media_url: null,
    media_type: null,
    time_limit_seconds: 20,
    points_base: 1000,
    scoring_type: 'linear',
    answers: [
      { id: '1', text: 'Cairo', color: '#e11d2e', shape: 'slash', is_correct: false },
      { id: '2', text: 'Alexandria', color: '#2454d6', shape: 'ring', is_correct: true },
    ],
  };
}

function session(patch: Partial<GameSessionRow>): GameSessionRow {
  return {
    id: 'sess-1',
    pin: '123456',
    status: 'question_active',
    current_question_index: 0,
    question_started_at: '2026-08-13T20:00:00.000Z',
    quiz_id: 'quiz-1',
    active_multiplier: 1,
    question_order: ['q1'],
    ...patch,
  };
}

const player: Player = {
  id: 'p1',
  session_id: 'sess-1',
  nickname: 'Ada',
  score: 0,
  streak: 0,
  joined_at: '2026-08-13T20:00:00.000Z',
  connected: true,
};

const quiz = { id: 'quiz-1', title: 'Geo' };

function renderHost(row: GameSessionRow, questions: Question[]) {
  return render(
    <HostGameClient initialSession={row} quiz={quiz} questions={questions} initialPlayers={[player]} />
  );
}

describe('projector clock, pause, and jump', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals only after the question clock and the host grace have both run out', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T20:00:18.000Z'));
    renderHost(session({ question_started_at: '2026-08-13T20:00:00.000Z' }), [question('q1', 'Capital')]);
    expect(screen.getByText('2')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(2_000 + HOST_REVEAL_DELAY_MS);
    });

    expect(hostApi.revealQuestionResults).toHaveBeenCalledWith('sess-1', 'q1');
  });

  it('holds the paused clock and asks the server to pause', async () => {
    const user = userEvent.setup();
    renderHost(
      session({
        status: 'question_paused',
        question_started_at: new Date(5_000).toISOString(),
      }),
      [question('q1', 'Capital')]
    );
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(hostApi.revealQuestionResults).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(hostApi.resumeGameSession).toHaveBeenCalledWith('sess-1');
  });

  it('jumps by the session order, not the list position alone', async () => {
    const user = userEvent.setup();
    renderHost(
      session({ question_order: ['q1', 'q2'] }),
      [question('q1', 'Capital'), question('q2', 'River')]
    );
    await user.click(screen.getByRole('button', { name: /jump/i }));
    await user.click(screen.getByRole('button', { name: /Q2/ }));
    expect(hostApi.goToNextQuestion).toHaveBeenCalledWith('sess-1', 1);
  });
});
