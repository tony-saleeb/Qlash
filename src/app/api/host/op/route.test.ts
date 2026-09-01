import { describe, expect, it, vi } from 'vitest';
import { jsonRequest, readJson } from '@/test/supabaseMock';

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
}));

vi.mock('@/app/actions/quizzes', () => ({
  cloneQuiz: vi.fn(),
  createPackQuiz: vi.fn(),
  createQuiz: vi.fn(),
  deleteQuiz: vi.fn(),
  enableQuizShare: vi.fn(),
  saveQuizData: vi.fn(),
}));

vi.mock('@/app/actions/reports', () => ({
  createRecapQuiz: vi.fn(),
}));

vi.mock('@/app/actions/host', () => ({
  setHostLocale: vi.fn(),
}));

describe('POST /api/host/op', () => {
  it('rejects a missing operation', async () => {
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(await POST(jsonRequest({})));
    expect(result.status).toBe(400);
  });

  it('opens a lobby without re-rendering the dashboard', async () => {
    const { POST } = await import('@/app/api/host/op/route');
    const result = await readJson(
      await POST(jsonRequest({ op: 'createGameSession', args: { quizId: 'quiz-1' } }))
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ data: { id: 'sess-1', pin: '123456' } });
  });
});
