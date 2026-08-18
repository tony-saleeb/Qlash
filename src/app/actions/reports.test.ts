import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createClient } from '@/lib/supabase/server';
import { getSessionReport } from '@/app/actions/reports';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const host = createClientMock({ id: 'host-1', email: 'host@qlash.test' });

describe('getSessionReport', () => {
  beforeEach(() => {
    host.reset();
    vi.mocked(createClient).mockReturnValue(host as never);
    host.auth.getUser.mockResolvedValue({
      data: { user: { id: 'host-1', email: 'host@qlash.test' } },
      error: null,
    });
  });

  it('rejects unauthenticated hosts', async () => {
    host.auth.getSession.mockResolvedValue({ data: { session: null } });
    host.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no' } });
    await expect(getSessionReport('s1')).rejects.toThrow(/Unauthorized/);
  });

  it('assembles a class report for the owning host', async () => {
    host.setTables({
      game_sessions: {
        data: {
          id: 's1',
          pin: '847291',
          status: 'finished',
          created_at: '2026-08-18T12:00:00.000Z',
          quiz_id: 'quiz-1',
          question_order: ['q1'],
          quizzes: { title: 'Geo', team_mode: false },
        },
        error: null,
      },
      players: {
        data: [{ id: 'p1', nickname: 'Ada', team_name: null, score: 1000, streak: 1 }],
        error: null,
      },
      questions: {
        data: [
          {
            id: 'q1',
            prompt: 'Capital?',
            type: 'mcq',
            order_index: 0,
            answers: [{ id: 'a', text: 'Paris', is_correct: true }],
          },
        ],
        error: null,
      },
      answers_submitted: {
        data: [
          {
            player_id: 'p1',
            question_id: 'q1',
            selected_answer_ids: ['a'],
            points_awarded: 1000,
            is_correct: true,
            time_taken_ms: 900,
          },
        ],
        error: null,
      },
    });

    const report = await getSessionReport('s1');
    expect(report.quizTitle).toBe('Geo');
    expect(report.pin).toBe('847291');
    expect(report.players[0].nickname).toBe('Ada');
    expect(report.questions[0].correct).toBe(1);
  });

  it('rejects a session the host does not own', async () => {
    host.setTable('game_sessions', { data: null, error: { message: 'not found' } });
    await expect(getSessionReport('missing')).rejects.toThrow(/Session not found/);
  });
});
