/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createClientMock } from '@/test/supabaseMock';

const router = { push: vi.fn(), prefetch: vi.fn() };
const supabase = createClientMock();
const { sendSessionEvent, sessionHandlers, channelState } = vi.hoisted(() => ({
  sendSessionEvent: vi.fn(),
  sessionHandlers: {
    current: {} as Record<string, (msg: { payload: Record<string, unknown> }) => void>,
  },
  channelState: { connection: 1 },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/hooks/useSessionChannel', () => ({
  useSessionChannel: (
    sessionId: string,
    options?: { onEvents?: Record<string, (msg: { payload: Record<string, unknown> }) => void> }
  ) => {
    void sessionId;
    sessionHandlers.current = options?.onEvents ?? {};
    return { send: sendSessionEvent, ready: true, connection: channelState.connection };
  },
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
  playClashSound: vi.fn(),
  playHaptic: vi.fn(),
  isGameAudioMuted: () => false,
  setGameAudioMuted: vi.fn(),
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), message: vi.fn() },
}));

import { toast } from 'sonner';
import PlayerGameClient from '@/app/play/[sessionId]/PlayerGameClient';
import { playIncorrectSound } from '@/lib/sounds';

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
    channelState.connection = 1;
    localStorage.clear();
    router.push.mockReset();
    sendSessionEvent.mockReset();
    vi.mocked(playIncorrectSound).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    supabase.channel.mockReset();
    supabase.channel.mockImplementation(() => {
      const ch = {
        on: vi.fn(() => ch),
        subscribe: vi.fn((cb?: (status: string) => void) => {
          cb?.('SUBSCRIBED');
          return ch;
        }),
        send: vi.fn(async () => 'ok'),
      };
      return ch;
    });
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
    expect(screen.getByText(/watch the big screen/i)).toBeInTheDocument();
    expect(screen.getByText(/tap a mark/i)).toBeInTheDocument();
  });

  it('cheers the projector with a Qlash mark', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'lobby' });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="lobby" />);
    await user.click(await screen.findByRole('button', { name: 'slash' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/react',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ sessionId: 'sess-1', playerId: 'p1', token: 'tok', mark: 'slash' }),
      })
    );
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

  it('refreshes the scoreboard and podium when the phone wakes', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    let phase: 'board' | 'podium' = 'board';
    const roster = () =>
      phase === 'board'
        ? [
            { nickname: 'Bea', score: 2000, streak: 1, connected: true, team_name: null, isMe: false },
            { nickname: 'Ada', score: 900, streak: 2, connected: true, team_name: null, isMe: true },
          ]
        : [
            { nickname: 'Bea', score: 2400, streak: 1, connected: true, team_name: null, isMe: false },
            { nickname: 'Ada', score: 1400, streak: 3, connected: true, team_name: null, isMe: true },
          ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player: { ...player, score: 100 }, sessionStatus: 'leaderboard' });
        }
        if (url.includes('/api/player/current-question')) {
          if (phase === 'podium') {
            return jsonResponse({ success: true, status: 'finished', question: null });
          }
          return jsonResponse({
            success: true,
            status: 'leaderboard',
            question_index: 0,
            server_started_at: new Date().toISOString(),
            question: {
              id: 'q1',
              type: 'mcq',
              prompt: 'Capital of France?',
              media_url: null,
              media_type: null,
              time_limit_seconds: 20,
              answers: [{ id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash' }],
            },
          });
        }
        if (url.includes('/api/player/roster')) {
          return jsonResponse({ players: roster() });
        }
        return jsonResponse({ players: [] });
      })
    );

    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="leaderboard" />);
    expect(await screen.findByText("You're #2")).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();

    phase = 'podium';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByRole('heading', { name: 'Bea' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByText(/#2/)).toBeInTheDocument();
    expect(screen.getAllByText('1,400').length).toBeGreaterThan(0);
    expect(screen.queryByText('#-')).not.toBeInTheDocument();
  });

  it('hydrates again when the realtime channel reconnects', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'question_active' });
      }
      if (url.includes('/api/player/current-question')) {
        return jsonResponse({
          success: true,
          status: 'question_active',
          question_index: 0,
          server_started_at: new Date().toISOString(),
          question: {
            id: 'q1',
            type: 'mcq',
            prompt: 'Capital of France?',
            media_url: null,
            media_type: null,
            time_limit_seconds: 20,
            answers: [{ id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash' }],
          },
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(
      <PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />
    );
    expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
    const before = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/player/current-question')).length;
    channelState.connection = 2;
    rerender(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await waitFor(() => {
      const after = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/player/current-question')).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('hydrates when the room moves to another question during reveal', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    let hydrates = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'question_active' });
        }
        if (url.includes('/api/player/current-question')) {
          hydrates += 1;
          const second = hydrates > 1;
          return jsonResponse({
            success: true,
            status: second ? 'question_reveal' : 'question_active',
            question_index: second ? 1 : 0,
            server_started_at: new Date().toISOString(),
            question: {
              id: second ? 'q2' : 'q1',
              type: 'mcq',
              prompt: second ? 'Next question?' : 'Capital of France?',
              media_url: null,
              media_type: null,
              time_limit_seconds: 20,
              answers: [{ id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash' }],
            },
          });
        }
        if (url.includes('/api/player/round-result')) {
          return jsonResponse({
            success: true,
            submitted: false,
            hadSubmission: false,
            submission: { is_correct: false, points_awarded: 0, was_late: false },
            player: { score: 0, streak: 0 },
            correctAnswerIds: ['a'],
          });
        }
        return jsonResponse({ players: [] });
      })
    );
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
    const before = hydrates;
    sessionHandlers.current['session:state']?.({
      payload: { new: { status: 'question_active', current_question_index: 0 } },
    });
    sessionHandlers.current['session:state']?.({
      payload: { new: { status: 'question_reveal', current_question_index: 1 } },
    });
    await waitFor(() => expect(hydrates).toBeGreaterThan(before));
  });

  it('drops a slow hydrate that finishes after the room moved on', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    let releaseSlow: () => void = () => undefined;
    let releaseNext: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    const next = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    let hydrates = 0;
    const answer = { id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'question_active' });
        }
        if (url.includes('/api/player/current-question')) {
          hydrates += 1;
          if (hydrates === 1) {
            await slow;
            return jsonResponse({
              success: true,
              status: 'question_active',
              question_index: 0,
              server_started_at: new Date().toISOString(),
              question: {
                id: 'q1',
                type: 'mcq',
                prompt: 'Old question',
                media_url: null,
                media_type: null,
                time_limit_seconds: 20,
                answers: [answer],
              },
            });
          }
          await next;
          return jsonResponse({
            success: true,
            status: 'question_active',
            question_index: 1,
            server_started_at: new Date().toISOString(),
            question: {
              id: 'q2',
              type: 'mcq',
              prompt: 'New question',
              media_url: null,
              media_type: null,
              time_limit_seconds: 20,
              answers: [answer],
            },
          });
        }
        return jsonResponse({}, 404);
      })
    );
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await waitFor(() => expect(hydrates).toBe(1));
    sessionHandlers.current['question:start']?.({
      payload: {
        question_id: 'q2',
        question_index: 1,
        type: 'mcq',
        prompt: 'New question',
        media_url: null,
        media_type: null,
        time_limit_seconds: 20,
        answers: [answer],
      },
    });
    expect(await screen.findByText('New question')).toBeInTheDocument();
    releaseSlow();
    await waitFor(() => expect(hydrates).toBe(2));
    expect(screen.queryByText('Old question')).not.toBeInTheDocument();
    releaseNext();
    expect(screen.getByText('New question')).toBeInTheDocument();
  });

  it('ignores a reveal for a question the host already skipped', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    let releaseReveal: () => void = () => undefined;
    const revealGate = new Promise<void>((resolve) => {
      releaseReveal = resolve;
    });
    let questions = 0;
    let rounds = 0;
    const answer = { id: 'b', text: '4', color: '#4a2aff', shape: 'qring' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'question_active' });
        }
        if (url.includes('/api/player/current-question')) {
          questions += 1;
          const skipped = questions > 1;
          return jsonResponse({
            success: true,
            status: 'question_active',
            question_index: skipped ? 1 : 0,
            server_started_at: new Date().toISOString(),
            question: {
              id: skipped ? 'q2' : 'q1',
              type: 'mcq',
              prompt: skipped ? 'Skipped ahead?' : '2 + 2?',
              media_url: null,
              media_type: null,
              time_limit_seconds: 20,
              answers: [answer],
            },
          });
        }
        if (url.includes('/api/player/round-result')) {
          rounds += 1;
          await revealGate;
          return jsonResponse({
            success: true,
            submitted: true,
            hadSubmission: true,
            submission: { is_correct: true, points_awarded: 1000, was_late: false, selected_answer_ids: ['b'] },
            player: { score: 1000, streak: 1 },
            correctAnswerIds: ['b'],
          });
        }
        return jsonResponse({ players: [] });
      })
    );
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    expect(await screen.findByText('2 + 2?')).toBeInTheDocument();
    revealQuestion();
    expect(await screen.findByRole('heading', { name: /checking your answer/i })).toBeInTheDocument();
    sessionHandlers.current['question:start']?.({
      payload: {
        question_id: 'q2',
        question_index: 1,
        type: 'mcq',
        prompt: 'Skipped ahead?',
        media_url: null,
        media_type: null,
        time_limit_seconds: 20,
        answers: [answer],
      },
    });
    expect(await screen.findByText('Skipped ahead?')).toBeInTheDocument();
    releaseReveal();
    await waitFor(() => expect(rounds).toBe(1));
    expect(screen.queryByRole('heading', { name: /^correct$/i })).not.toBeInTheDocument();
    expect(screen.getByText('Skipped ahead?')).toBeInTheDocument();
  });

  it('locks a reloaded phone on the answer the server already stored', async () => {
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
            submitted_answer_ids: ['b'],
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
              ],
            },
          });
        }
        return jsonResponse({}, 404);
      })
    );

    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    expect(await screen.findByText('Answer locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /paris/i })).not.toBeInTheDocument();
  });

  it('still shows the question after a throttled hydrate', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    let hydrateCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'question_active' });
        }
        if (url.includes('/api/player/current-question')) {
          hydrateCalls += 1;
          if (hydrateCalls === 1) {
            return new Response(JSON.stringify({ error: 'Too many requests. Please wait.' }), {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': '1' },
            });
          }
          return jsonResponse({
            success: true,
            status: 'question_active',
            server_started_at: new Date().toISOString(),
            question: {
              id: 'q1',
              type: 'mcq',
              prompt: 'Which month starts the Coptic year?',
              media_url: null,
              media_type: null,
              time_limit_seconds: 20,
              answers: [
                { id: 'a', text: 'Tout', color: '#e11d2e', shape: 'slash' },
                { id: 'b', text: 'Baba', color: '#4a2aff', shape: 'qring' },
              ],
            },
          });
        }
        return jsonResponse({}, 404);
      })
    );

    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    expect(
      await screen.findByText('Which month starts the Coptic year?', undefined, { timeout: 5000 })
    ).toBeInTheDocument();
    expect(hydrateCalls).toBeGreaterThan(1);
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
        return jsonResponse({ success: true, duplicate: false, message: 'Answer submitted successfully.' });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await user.click(await screen.findByRole('button', { name: /^4$/ }));
    expect(await screen.findByText(/answer locked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'slash' })).toBeInTheDocument();
    expect(screen.getByText(/tap a mark/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'slash' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/react',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionId: 'sess-1', playerId: 'p1', token: 'tok', mark: 'slash' }),
      })
    );
  });

  it('lets a lobby player leave and clears their token', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'lobby' });
      }
      if (url.includes('/api/player/leave')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          sessionId: 'sess-1',
          playerId: 'p1',
          token: 'tok',
        });
        return jsonResponse({ success: true, roomClosed: true });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="lobby" />);
    await user.click(await screen.findByRole('button', { name: /leave/i }));
    expect(localStorage.getItem('quizarena_token_sess-1')).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/play');
  });

  function revealQuestion() {
    sessionHandlers.current['session:state']?.({ payload: { new: { status: 'question_reveal' } } });
  }

  const questionPayload = {
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
  };

  it('shows checking then the server result, and never the wrong-answer sound for a correct answer', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    let releaseResult: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseResult = resolve;
    });
    let resultReleased = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'question_active' });
      }
      if (url.includes('/api/player/current-question')) {
        return jsonResponse(questionPayload);
      }
      if (url.includes('/api/submit-answer')) {
        return jsonResponse({ success: true, duplicate: false, message: 'Answer submitted successfully.' });
      }
      if (url.includes('/api/player/round-result')) {
        if (!resultReleased) await gate;
        return jsonResponse({
          success: true,
          submitted: true,
          hadSubmission: true,
          submission: { is_correct: true, points_awarded: 1000, was_late: false },
          player: { score: 1000, streak: 1 },
          correctAnswerIds: ['b'],
        });
      }
      return jsonResponse({ players: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await user.click(await screen.findByRole('button', { name: /^4$/ }));
    expect(await screen.findByText(/answer locked/i)).toBeInTheDocument();
    revealQuestion();
    expect(await screen.findByRole('heading', { name: /checking your answer/i })).toBeInTheDocument();
    resultReleased = true;
    releaseResult?.();
    expect(await screen.findByRole('heading', { name: 'Correct' })).toBeInTheDocument();
    expect(playIncorrectSound).not.toHaveBeenCalled();
  });

  it('reopens the choices when the tap lands while the question is paused', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'question_active' });
      }
      if (url.includes('/api/player/current-question')) {
        return jsonResponse(questionPayload);
      }
      if (url.includes('/api/submit-answer')) {
        return jsonResponse({ error: 'The question is paused.' }, 403);
      }
      if (url.includes('/api/player/round-result')) {
        return jsonResponse({
          success: true,
          submitted: false,
          hadSubmission: false,
          submission: { is_correct: false, points_awarded: 0, was_late: false },
          player: { score: 0, streak: 0 },
          correctAnswerIds: ['b'],
        });
      }
      return jsonResponse({ players: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await user.click(await screen.findByRole('button', { name: /^4$/ }));
    expect(await screen.findByRole('button', { name: /^4$/ })).toBeInTheDocument();
    expect(screen.queryByText(/answer locked/i)).not.toBeInTheDocument();
    revealQuestion();
    expect(await screen.findByRole('heading', { name: /missed/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /time.s up/i })).not.toBeInTheDocument();
  });

  it('shows time is up when the player tapped but the server recorded no answer', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'question_active' });
      }
      if (url.includes('/api/player/current-question')) {
        return jsonResponse(questionPayload);
      }
      if (url.includes('/api/submit-answer')) {
        return jsonResponse({ success: true, duplicate: false, message: 'Answer submitted successfully.' });
      }
      if (url.includes('/api/player/round-result')) {
        return jsonResponse({
          success: true,
          submitted: false,
          hadSubmission: false,
          submission: { is_correct: false, points_awarded: 0, was_late: false },
          player: { score: 0, streak: 0 },
          correctAnswerIds: ['b'],
        });
      }
      return jsonResponse({ players: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await user.click(await screen.findByRole('button', { name: /^4$/ }));
    expect(await screen.findByText(/answer locked/i)).toBeInTheDocument();
    revealQuestion();
    expect(await screen.findByRole('heading', { name: /time.s up/i })).toBeInTheDocument();
  });

  function startQuestion(answers: { id: string; text: string; color: string; shape: string }[]) {
    sessionHandlers.current['question:start']?.({
      payload: {
        question_id: 'q1',
        question_index: 0,
        type: 'mcq',
        prompt: questionPayload.question.prompt,
        media_url: null,
        media_type: null,
        time_limit_seconds: questionPayload.question.time_limit_seconds,
        answers,
        server_started_at: questionPayload.server_started_at,
      },
    });
  }

  it('keeps a tapped answer locked when question:start repeats the same round', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'question_active' });
      }
      if (url.includes('/api/player/current-question')) {
        return jsonResponse(questionPayload);
      }
      if (url.includes('/api/submit-answer')) {
        return jsonResponse({ success: true, duplicate: false, message: 'Answer submitted successfully.' });
      }
      return jsonResponse({ players: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await user.click(await screen.findByRole('button', { name: /^4$/ }));
    expect(await screen.findByText(/answer locked/i)).toBeInTheDocument();

    startQuestion([...questionPayload.question.answers].reverse());
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/player/current-question'))
      ).toHaveLength(2);
    });
    expect(screen.getByText(/answer locked/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^3$/ })).not.toBeInTheDocument();
  });

  it('never moves answer buttons once they are on screen', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    const original = [
      { id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash' },
      { id: 'b', text: 'Lyon', color: '#4a2aff', shape: 'qring' },
      { id: 'c', text: 'Nice', color: '#c8f542', shape: 'bolt' },
      { id: 'd', text: 'Lille', color: '#0a6b5c', shape: 'chevron' },
    ];
    let served = original;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'question_active' });
        }
        if (url.includes('/api/player/current-question')) {
          return jsonResponse({ ...questionPayload, question: { ...questionPayload.question, answers: served } });
        }
        return jsonResponse({ players: [] });
      })
    );
    const answerButtons = () =>
      screen.getAllByRole('button', { name: /paris|lyon|nice|lille/i }).map((el) => el.textContent);

    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await screen.findByRole('button', { name: /^paris$/i });
    const before = answerButtons();

    served = [
      { ...original[3] },
      { ...original[2] },
      { ...original[0], text: 'Paris (FR)' },
      { ...original[1] },
    ];
    startQuestion(served);
    await screen.findByRole('button', { name: /paris \(fr\)/i });
    expect(answerButtons()).toEqual(before.map((text) => (text === 'Paris' ? 'Paris (FR)' : text)));
  });

  it('lets the player tap again when the answer never reached the server', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    let submits = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/player/me')) {
        return jsonResponse({ player, sessionStatus: 'question_active' });
      }
      if (url.includes('/api/player/current-question')) {
        return jsonResponse(questionPayload);
      }
      if (url.includes('/api/submit-answer')) {
        submits += 1;
        if (submits <= 2) return jsonResponse({ error: 'Internal Server Error' }, 500);
        return jsonResponse({ success: true, duplicate: false, message: 'Answer submitted successfully.' });
      }
      return jsonResponse({ players: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="question_active" />);
    await user.click(await screen.findByRole('button', { name: /^4$/ }));
    const again = await screen.findByRole('button', { name: /^4$/ }, { timeout: 3000 });
    expect(toast.message).toHaveBeenCalledWith('Failed to submit — tap again.');
    expect(screen.queryByText(/answer locked/i)).not.toBeInTheDocument();

    await user.click(again);
    expect(await screen.findByText(/answer locked/i)).toBeInTheDocument();
    expect(submits).toBe(3);
  });

  it('stays in the room when a different player is removed', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'lobby' });
        }
        return jsonResponse({}, 404);
      })
    );
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="lobby" />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    sessionHandlers.current['player:removed']?.({ payload: { player_id: 'someone-else' } });
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(localStorage.getItem('quizarena_token_sess-1')).toBe('tok');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('leaves and clears the token when this player is removed', async () => {
    localStorage.setItem('quizarena_token_sess-1', 'tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/player/me')) {
          return jsonResponse({ player, sessionStatus: 'lobby' });
        }
        return jsonResponse({}, 404);
      })
    );
    render(<PlayerGameClient sessionId="sess-1" initialSessionStatus="lobby" />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    sessionHandlers.current['player:removed']?.({ payload: { player_id: 'p1' } });
    expect(localStorage.getItem('quizarena_token_sess-1')).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/play');
  });
});
