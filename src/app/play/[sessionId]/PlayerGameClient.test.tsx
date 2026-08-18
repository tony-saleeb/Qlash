/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createClientMock } from '@/test/supabaseMock';

const router = { push: vi.fn(), prefetch: vi.fn() };
const supabase = createClientMock();

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/hooks/useSessionChannel', () => ({
  useSessionChannel: () => ({ send: vi.fn(), ready: true }),
}));

vi.mock('@/app/actions/game', () => ({
  updatePlayerConnection: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/sounds', () => ({
  bindAudioUnlock: () => () => undefined,
  unlockGameAudio: vi.fn(async () => true),
  playCorrectSound: vi.fn(),
  playIncorrectSound: vi.fn(),
  playFanfareSound: vi.fn(),
  playJoinSound: vi.fn(),
  playLockSound: vi.fn(),
  playQuestionStartSound: vi.fn(),
  playTickSound: vi.fn(),
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import PlayerGameClient from '@/app/play/[sessionId]/PlayerGameClient';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const player = {
  id: 'p1',
  session_id: 'sess-1',
  nickname: 'Ada',
  team_name: null,
  score: 0,
  streak: 0,
  joined_at: '2026-08-13T20:00:00.000Z',
  connected: true,
};

describe('PlayerGameClient', () => {
  beforeEach(() => {
    localStorage.clear();
    router.push.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends players without a token back to join', async () => {
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="lobby" />);
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/play');
    });
  });

  it('shows the lobby waiting card after token auth', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'lobby' });
        }
        if (url.includes('/api/player/current-question')) {
          return jsonResponse({ success: true, status: 'lobby', question: null });
        }
        return jsonResponse({}, 404);
      })
    );

    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="lobby" />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText(/waiting for host/i)).toBeInTheDocument();
  });

  it('renders Qlash answer tiles for an active MCQ', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'question_active' });
        }
        if (url.includes('/api/player/current-question')) {
          return jsonResponse({
            success: true,
            status: 'question_active',
            active_multiplier: 1,
            server_started_at: new Date().toISOString(),
            question: {
              id: 'q1',
              type: 'mcq',
              prompt: 'Capital of France?',
              media_url: null,
              media_type: null,
              time_limit_seconds: 20,
              answers: [
                { id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash' },
                { id: 'b', text: 'Lyon', color: '#4a2aff', shape: 'qring' },
                { id: 'c', text: 'Nice', color: '#c8f542', shape: 'bolt' },
                { id: 'd', text: 'Lille', color: '#0a6b5c', shape: 'chevron' },
              ],
            },
          });
        }
        return jsonResponse({}, 404);
      })
    );

    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paris/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lyon/i })).toBeInTheDocument();
  });

  it('locks an MCQ choice through submit-answer', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'question_active' });
      }
      if (url.includes('/api/player/current-question')) {
        return jsonResponse({
          success: true,
          status: 'question_active',
          server_started_at: new Date().toISOString(),
          question: {
            id: 'q1',
            type: 'mcq',
            prompt: '2 + 2?',
            media_url: null,
            media_type: null,
            time_limit_seconds: 30,
            answers: [
              { id: 'a', text: '3', color: '#e11d2e', shape: 'slash' },
              { id: 'b', text: '4', color: '#4a2aff', shape: 'qring' },
            ],
          },
        });
      }
      if (url.includes('/api/submit-answer')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          sessionId: 'sess-1',
          playerId: 'p1',
          token: 'tok',
          questionId: 'q1',
          selectedAnswerIds: ['b'],
        });
        return jsonResponse({ success: true, isCorrect: true, pointsAwarded: 1000, duplicate: false });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await user.click(await screen.findByRole('button', { name: /^4$/ }));
    expect(await screen.findByText(/answer locked/i)).toBeInTheDocument();
  });
});
