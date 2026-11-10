/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import type { GameSessionRow, Player, Question } from '@/lib/game/types';

const supabase = createClientMock();
const pauseGameSession = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/hooks/useSessionChannel', () => ({
  useSessionChannel: () => ({ send: vi.fn(), ready: true, connection: 1 }),
}));

vi.mock('@/lib/host/hostApi', () => ({
  addQuestionTime: vi.fn(async () => ({ success: true, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  goToLeaderboard: vi.fn(async () => ({})),
  goToNextQuestion: vi.fn(async () => ({ success: true, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  goToPodium: vi.fn(async () => ({})),
  pauseGameSession,
  revealQuestionResults: vi.fn(async () => ({ optionCounts: {}, leaderboard: [] })),
  resumeGameSession: vi.fn(async () => ({ success: true, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  startGameSession: vi.fn(async () => ({ success: true, serverStartedAt: '2026-08-13T20:00:00.000Z' })),
  endGameSession: vi.fn(async () => ({})),
  setHostLocale: vi.fn(async () => ({})),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

vi.mock('@/components/brand/LobbyQr', () => ({
  LobbyQr: () => null,
}));

import HostClickerClient from '@/app/host/[sessionId]/HostClickerClient';

const question: Question = {
  id: 'q1',
  type: 'mcq',
  prompt: 'Capital',
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

const player: Player = {
  id: 'p1',
  session_id: 'sess-1',
  nickname: 'Ada',
  score: 0,
  streak: 0,
  joined_at: '2026-08-13T20:00:00.000Z',
  connected: true,
};

describe('clicker pause clock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.reset();
  });

  it('shows the frozen paused seconds and pauses through the server', async () => {
    const user = userEvent.setup();
    const row: GameSessionRow = {
      id: 'sess-1',
      pin: '123456',
      status: 'question_active',
      current_question_index: 0,
      question_started_at: new Date(Date.now() - 5_000).toISOString(),
      quiz_id: 'quiz-1',
      question_order: ['q1'],
    };
    const view = render(
      <HostClickerClient
        initialSession={row}
        quiz={{ id: 'quiz-1', title: 'Geo' }}
        questions={[question]}
        initialPlayers={[player]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pauseGameSession).toHaveBeenCalledWith('sess-1');
    view.unmount();

    render(
      <HostClickerClient
        initialSession={{
          ...row,
          status: 'question_paused',
          question_started_at: new Date(5_000).toISOString(),
        }}
        quiz={{ id: 'quiz-1', title: 'Geo' }}
        questions={[question]}
        initialPlayers={[player]}
      />
    );
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText(/· Paused/)).toBeTruthy();
  });
});
