import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

const liveSession = {
  status: 'question_active',
  current_question_index: 1,
  question_started_at: '2026-08-13T20:00:00.000Z',
  quiz_id: 'quiz-1',
  active_multiplier: 2,
  question_order: ['q0', 'q1'],
};

const dbQuestion = {
  id: 'q1',
  type: 'mcq',
  prompt: '2+2?',
  media_url: null,
  media_type: null,
  time_limit_seconds: 20,
  answers: [
    { id: 'a', text: '4', color: '#1368ce', shape: 'diamond', is_correct: true },
    { id: 'b', text: '5', color: '#e21b3c', shape: 'triangle', is_correct: false },
  ],
  quizzes: { randomize_answers: false },
};

describe('POST /api/player/current-question', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('requires session, player, and token', async () => {
    const { POST } = await import('@/app/api/player/current-question/route');
    expect((await readJson(await POST(jsonRequest({ sessionId: 's' })))).status).toBe(400);
  });

  it('rejects a token mismatch', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'other' }, error: null },
      players: { data: { id: 'p1' }, error: null },
      game_sessions: { data: liveSession, error: null },
    });
    const { POST } = await import('@/app/api/player/current-question/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(401);
  });

  it('returns null question in lobby or finished without leaking answers', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1' }, error: null },
      game_sessions: { data: { ...liveSession, status: 'finished' }, error: null },
    });
    const { POST } = await import('@/app/api/player/current-question/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, status: 'finished', question: null });
    expect(admin.from).not.toHaveBeenCalledWith('questions');
  });

  it('tells a reloaded phone which answer is already stored', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1' }, error: null },
      game_sessions: { data: liveSession, error: null },
      questions: { data: dbQuestion, error: null },
      answers_submitted: { data: { selected_answer_ids: ['b'] }, error: null },
    });
    const { POST } = await import('@/app/api/player/current-question/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.submitted_answer_ids).toEqual(['b']);
    expect(result.body.question.answers[0]).not.toHaveProperty('is_correct');
  });

  it('hydrates the public question during reveal so late joiners can recover', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1' }, error: null },
      game_sessions: { data: { ...liveSession, status: 'question_reveal' }, error: null },
      questions: { data: dbQuestion, error: null },
    });
    const { POST } = await import('@/app/api/player/current-question/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('question_reveal');
    expect(result.body.question.id).toBe('q1');
    expect(result.body.question.answers[0]).not.toHaveProperty('is_correct');
  });

  it('hydrates the public question by session order and strips is_correct', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1' }, error: null },
      game_sessions: { data: liveSession, error: null },
      questions: { data: dbQuestion, error: null },
    });
    const { POST } = await import('@/app/api/player/current-question/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.active_multiplier).toBe(2);
    expect(result.body.server_started_at).toBe(liveSession.question_started_at);
    expect(result.body.question.answers).toEqual([
      { id: 'a', text: '4', color: '#4a2aff', shape: 'qring' },
      { id: 'b', text: '5', color: '#e11d2e', shape: 'slash' },
    ]);
    expect(result.body.question.answers[0]).not.toHaveProperty('is_correct');
  });

  it('hydrates randomized answers with a stable session seed', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p1' }, error: null },
      game_sessions: { data: liveSession, error: null },
      questions: {
        data: { ...dbQuestion, quizzes: { randomize_answers: true } },
        error: null,
      },
    });
    const { POST } = await import('@/app/api/player/current-question/route');
    const first = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    const second = await readJson(
      await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
    );
    expect(first.status).toBe(200);
    expect(first.body.question.answers.map((a: { id: string }) => a.id)).toEqual(
      second.body.question.answers.map((a: { id: string }) => a.id)
    );
    expect(first.body.question.answers[0]).not.toHaveProperty('is_correct');
  });

  it('hands phones the same randomized layout the host broadcasts and projects', async () => {
    const answers = [
      { id: '1', text: 'Cairo', color: '#e11d2e', shape: 'slash', is_correct: false },
      { id: '2', text: 'Giza', color: '#4a2aff', shape: 'qring', is_correct: true },
      { id: '3', text: 'Luxor', color: '#c8f542', shape: 'bolt', is_correct: false },
      { id: '4', text: 'Aswan', color: '#0a6b5c', shape: 'chevron', is_correct: false },
    ];
    const { answersInPlayOrder } = await import('@/lib/game/shuffle');
    const { buildQuestionStartPayload } = await import('@/lib/game/types');
    const { POST } = await import('@/app/api/player/current-question/route');

    for (const qid of ['q1', 'q-7', '5fc45a26-abb2-4891-9772-a4dd6752781a']) {
      admin.setTables({
        player_tokens: { data: { client_token: 'tok' }, error: null },
        players: { data: { id: 'p1' }, error: null },
        game_sessions: { data: { ...liveSession, question_order: ['q0', qid] }, error: null },
        questions: {
          data: { ...dbQuestion, id: qid, answers, quizzes: { randomize_answers: true } },
          error: null,
        },
      });
      const seed = `sess-1:${qid}`;
      const projected = answersInPlayOrder(answersInPlayOrder(answers, true, seed), true, seed);
      const broadcast = buildQuestionStartPayload(
        { ...dbQuestion, id: qid, points_base: 1000, scoring_type: 'linear', answers: projected },
        1,
        liveSession.question_started_at
      );

      const hydrated = await readJson(
        await POST(jsonRequest({ sessionId: 'sess-1', playerId: 'p1', token: 'tok' }))
      );
      expect(hydrated.status).toBe(200);
      const phoneIds = hydrated.body.question.answers.map((a: { id: string }) => a.id);
      expect(phoneIds).toEqual(broadcast.answers.map((a) => a.id));
      expect(phoneIds).toEqual(projected.map((a) => a.id));
    }
  });
});
