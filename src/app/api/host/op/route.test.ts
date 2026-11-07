import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest, readJson } from '@/test/supabaseMock';
import { createGameSession } from '@/app/actions/game';
import { readHostAuth } from '@/lib/supabase/hostAuth';

type RateLimitResult = { ok: boolean; retryAfterSec?: number };
type RateLimitParams = { key: string; limit: number; windowMs: number };

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn((params: RateLimitParams): RateLimitResult => {
    void params;
    return { ok: true };
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (params: RateLimitParams) => rateLimitMock(params),
  clientIpFromRequest: () => 'test-ip',
}));

vi.mock('@/lib/supabase/hostAuth', () => ({
  readHostAuth: vi.fn(async () => ({
    supabase: {},
    user: { id: 'host-1', email: 'host@qlash.test' },
  })),
}));

vi.mock('@/app/actions/game', () => ({
  createGameSession: vi.fn(async () => ({ id: 'sess-1', pin: '123456' })),
  endGameSession: vi.fn(),
  kickPlayer: vi.fn(),
  revealQuestionResults: vi.fn(),
  goToLeaderboard: vi.fn(),
  goToNextQuestion: vi.fn(),
  goToPodium: vi.fn(),
  setSessionMultiplier: vi.fn(),
  startGameSession: vi.fn(),
  pauseGameSession: vi.fn(),
  resumeGameSession: vi.fn(),
  addQuestionTime: vi.fn(),
  setLateJoinThroughIndex: vi.fn(),
  setJoinLocked: vi.fn(),
}));

vi.mock('@/app/actions/quizzes', () => ({
  cloneQuiz: vi.fn(),
  createPackQuiz: vi.fn(),
  createQuiz: vi.fn(),
  deleteQuiz: vi.fn(),
  enableQuizShare: vi.fn(),
  rotateQuizShare: vi.fn(),
  stopQuizShare: vi.fn(),
  saveQuizData: vi.fn(),
}));

vi.mock('@/app/actions/reports', () => ({
  createRecapQuiz: vi.fn(),
}));

vi.mock('@/app/actions/host', () => ({
  setHostLocale: vi.fn(),
}));

function hostRequest(body: unknown, headers?: Record<string, string>) {
  return jsonRequest(body, {
    origin: 'http://localhost',
    'sec-fetch-site': 'same-origin',
    ...headers,
  });
}

describe('POST /api/host/op', () => {
  beforeEach(() => {
    rateLimitMock.mockReset();
    rateLimitMock.mockReturnValue({ ok: true });
    vi.mocked(createGameSession).mockClear();
    vi.mocked(readHostAuth).mockResolvedValue({
      supabase: {} as never,
      user: { id: 'host-1', email: 'host@qlash.test' },
    });
    vi.mocked(createGameSession).mockResolvedValue({ id: 'sess-1', pin: '123456' });
  });

  it('rejects a missing operation', async () => {
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(await POST(hostRequest({})));
    expect(result.status).toBe(400);
  });

  it('opens a lobby without re-rendering the dashboard', async () => {
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(
      await POST(hostRequest({ op: 'createGameSession', args: { quizId: 'quiz-1' } }))
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ data: { id: 'sess-1', pin: '123456' } });
    const keys = rateLimitMock.mock.calls.map((call) => call[0].key);
    expect(keys).toEqual(['host-op:ip:test-ip', 'host-op:host-1']);
  });

  it('rejects an unknown operation', async () => {
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(await POST(hostRequest({ op: 'dropDatabase' })));
    expect(result.status).toBe(400);
  });

  it('refuses a cross-site request before it opens a lobby', async () => {
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(
      await POST(
        hostRequest(
          { op: 'createGameSession', args: { quizId: 'quiz-1' } },
          { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }
        )
      )
    );
    expect(result.status).toBe(403);
    expect(createGameSession).not.toHaveBeenCalled();
  });

  it('hides a database error', async () => {
    vi.mocked(createGameSession).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "game_sessions_pin_key"')
    );
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(
      await POST(hostRequest({ op: 'createGameSession', args: { quizId: 'quiz-1' } }))
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'Could not complete that.' });
  });

  it('rate limits a host', async () => {
    rateLimitMock.mockReturnValueOnce({ ok: true }).mockReturnValueOnce({ ok: false, retryAfterSec: 12 });
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(
      await POST(hostRequest({ op: 'createGameSession', args: { quizId: 'quiz-1' } }))
    );
    expect(result.status).toBe(429);
    expect(result.headers.get('Retry-After')).toBe('12');
    expect(createGameSession).not.toHaveBeenCalled();
  });
});
