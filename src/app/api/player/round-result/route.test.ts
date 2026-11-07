import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

describe('POST /api/player/round-result', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('requires all identity fields', async () => {
    const { POST } = await import('@/app/api/player/round-result/route');
    expect((await readJson(await POST(jsonRequest({ sessionId: 's', playerId: 'p' })))).status).toBe(400);
  });

  it('rejects a bad token', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'other' }, error: null },
      game_sessions: { data: { status: 'question_reveal' }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(401);
  });

  it('hides results until reveal/leaderboard/finished', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p', score: 0, streak: 0 }, error: null },
      game_sessions: { data: { status: 'question_active', current_question_index: 0 }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(403);
  });

  it('returns the caller submission and live score, defaulting a miss when none exists', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      game_sessions: {
        data: {
          status: 'question_reveal',
          quiz_id: 'quiz-1',
          question_order: ['q'],
          current_question_index: 0,
        },
        error: null,
      },
      answers_submitted: { data: null, error: null },
      players: { data: { id: 'p', score: 1200, streak: 0 }, error: null },
      questions: {
        data: {
          id: 'q',
          order_index: 0,
          answers: [
            { id: 'a', is_correct: true },
            { id: 'b', is_correct: false },
          ],
        },
        error: null,
      },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.hadSubmission).toBe(false);
    expect(result.body.submitted).toBe(false);
    expect(result.body.submission).toEqual({ points_awarded: 0, is_correct: false, was_late: false });
    expect(result.body.player).toEqual({ score: 1200, streak: 0 });
    expect(result.body.correctAnswerIds).toEqual(['a']);
  });

  it('returns the stored choice so the reveal card does not show a later tap', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      game_sessions: {
        data: {
          status: 'question_reveal',
          quiz_id: 'quiz-1',
          question_order: ['q'],
          current_question_index: 0,
        },
        error: null,
      },
      answers_submitted: {
        data: {
          points_awarded: 0,
          is_correct: false,
          was_late: false,
          selected_answer_ids: ['b'],
        },
        error: null,
      },
      players: { data: { id: 'p', score: 0, streak: 0 }, error: null },
      questions: {
        data: {
          id: 'q',
          order_index: 0,
          answers: [
            { id: 'a', is_correct: true },
            { id: 'b', is_correct: false },
          ],
        },
        error: null,
      },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.submission.selected_answer_ids).toEqual(['b']);
    expect(result.body.submission.is_correct).toBe(false);
  });

  it('returns 404 when the player is not in this session and leaks no answer key', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: null, error: null },
      game_sessions: {
        data: { status: 'finished', quiz_id: 'quiz-1', question_order: ['q'], current_question_index: 0 },
        error: null,
      },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 'other', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(404);
    expect(result.body.correctAnswerIds).toBeUndefined();
  });

  it('refuses a question that has not been revealed yet', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p', score: 0, streak: 0 }, error: null },
      game_sessions: {
        data: {
          status: 'question_reveal',
          quiz_id: 'quiz-1',
          question_order: ['q0', 'q1'],
          current_question_index: 0,
        },
        error: null,
      },
      questions: { data: { id: 'q1', order_index: 1, answers: [{ id: 'a', is_correct: true }] }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q1' }))
    );
    expect(result.status).toBe(403);
  });

  it('returns 404 and no answer key when the question is not on this quiz', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p', score: 0, streak: 0 }, error: null },
      game_sessions: {
        data: {
          status: 'question_reveal',
          quiz_id: 'quiz-1',
          question_order: ['q1'],
          current_question_index: 0,
        },
        error: null,
      },
      questions: { data: null, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const missing = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'foreign' }))
    );
    expect(missing.status).toBe(404);
    expect(missing.body.correctAnswerIds).toBeUndefined();
  });

  it('returns the answer key for the question currently in reveal', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p', score: 10, streak: 1 }, error: null },
      game_sessions: {
        data: {
          status: 'question_reveal',
          quiz_id: 'quiz-1',
          question_order: ['q0', 'q1'],
          current_question_index: 1,
        },
        error: null,
      },
      questions: { data: { id: 'q1', order_index: 1, answers: [{ id: 'a', is_correct: true }] }, error: null },
      answers_submitted: { data: { points_awarded: 500, is_correct: true, was_late: false }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q1' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.correctAnswerIds).toEqual(['a']);
  });

  it('passes was_late through on the submission', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p', score: 0, streak: 0 }, error: null },
      game_sessions: {
        data: { status: 'finished', quiz_id: 'quiz-1', question_order: ['q'], current_question_index: 0 },
        error: null,
      },
      questions: { data: { id: 'q', order_index: 0, answers: [] }, error: null },
      answers_submitted: { data: { points_awarded: 0, is_correct: true, was_late: true }, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    const result = await readJson(
      await POST(jsonRequest({ sessionId: 's', playerId: 'p', token: 'tok', questionId: 'q' }))
    );
    expect(result.status).toBe(200);
    expect(result.body.submission.was_late).toBe(true);
  });

  it('scopes the player lookup to this session', async () => {
    admin.setTables({
      player_tokens: { data: { client_token: 'tok' }, error: null },
      players: { data: { id: 'p', score: 1, streak: 0 }, error: null },
      game_sessions: {
        data: { status: 'finished', quiz_id: 'quiz-1', question_order: ['q'], current_question_index: 0 },
        error: null,
      },
      questions: { data: { id: 'q', order_index: 0, answers: [] }, error: null },
      answers_submitted: { data: null, error: null },
    });
    const { POST } = await import('@/app/api/player/round-result/route');
    await POST(jsonRequest({ sessionId: 'sess-9', playerId: 'p', token: 'tok', questionId: 'q' }));
    const playersCall = [...admin.fromCalls].reverse().find((entry) => entry.table === 'players');
    const captured = (
      playersCall?.chain as { _captured?: { method: string; args: unknown[] }[] }
    )._captured;
    const eqs = captured?.filter((item) => item.method === 'eq') ?? [];
    expect(eqs).toEqual([
      { method: 'eq', args: ['id', 'p'] },
      { method: 'eq', args: ['session_id', 'sess-9'] },
    ]);
  });
});
