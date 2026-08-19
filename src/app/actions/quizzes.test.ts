import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_QUIZ_THEME } from '@/lib/game/theme';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const host = createClientMock({ id: 'host-1', email: 'host@qlash.test' });

describe('quiz library actions', () => {
  beforeEach(() => {
    host.reset();
    vi.mocked(createClient).mockReturnValue(host as never);
    host.auth.getUser.mockResolvedValue({
      data: { user: { id: 'host-1', email: 'host@qlash.test' } },
      error: null,
    });
  });

  it('creates a quiz with the Qlash default theme', async () => {
    host.setTables({
      hosts: { data: { plan: 'pro' }, error: null },
      quizzes: { data: { id: 'q1', title: 'Clash' }, error: null },
    });
    const { createQuiz } = await import('@/app/actions/quizzes');
    await createQuiz('Clash', 'live');
    expect(host.lastInsert('quizzes')).toEqual({
      host_id: 'host-1',
      title: 'Clash',
      description: 'live',
      theme: DEFAULT_QUIZ_THEME,
    });
  });

  it('deletes only the owning host quiz', async () => {
    host.setTable('quizzes', { data: {}, error: null });
    const { deleteQuiz } = await import('@/app/actions/quizzes');
    await expect(deleteQuiz('q1')).resolves.toEqual({ success: true });
  });

  it('clones quiz metadata and remaps question rows onto the new id', async () => {
    host.setTables({
      hosts: { data: { plan: 'pro' }, error: null },
      quizzes: [
        {
          data: {
            id: 'orig',
            host_id: 'host-1',
            title: 'Original',
            description: 'd',
            theme: DEFAULT_QUIZ_THEME,
            randomize_questions: true,
            randomize_answers: false,
            team_mode: true,
            double_points_rounds: ['0'],
            cover_image_url: null,
          },
          error: null,
        },
        { data: { id: 'copy', title: 'Original (Copy)' }, error: null },
      ],
      questions: [
        {
          data: [
            {
              quiz_id: 'orig',
              order_index: 0,
              type: 'mcq',
              prompt: 'Hi',
              media_url: null,
              media_type: null,
              time_limit_seconds: 20,
              points_base: 1000,
              scoring_type: 'linear',
              answers: [],
            },
          ],
          error: null,
        },
        { data: {}, error: null },
      ],
    });
    const { cloneQuiz } = await import('@/app/actions/quizzes');
    const copy = await cloneQuiz('orig');
    expect(copy.title).toBe('Original (Copy)');
    expect(host.lastInsert('quizzes')).toMatchObject({
      host_id: 'host-1',
      title: 'Original (Copy)',
      team_mode: true,
    });
    expect(host.lastInsert('questions')).toEqual([
      expect.objectContaining({ quiz_id: 'copy', prompt: 'Hi', order_index: 0 }),
    ]);
  });

  it('rejects unauthenticated library access', async () => {
    host.auth.getSession.mockResolvedValue({ data: { session: null } });
    host.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no' } });
    const { createQuiz } = await import('@/app/actions/quizzes');
    await expect(createQuiz('Clash')).rejects.toThrow(/Unauthorized/);
  });

  it('rejects a sixth quiz on the free plan', async () => {
    host.setTables({
      hosts: { data: { plan: 'free' }, error: null },
      quizzes: { data: null, error: null, count: 5 },
    });
    const { createQuiz } = await import('@/app/actions/quizzes');
    await expect(createQuiz('Clash')).rejects.toThrow(/5 saved quizzes/);
    expect(host.lastInsert('quizzes')).toBeUndefined();
  });

  it('adds a content pack into the host library', async () => {
    host.setTables({
      hosts: { data: { plan: 'pro' }, error: null },
      quizzes: { data: { id: 'pack-1', title: 'تسخين الحصة' }, error: null },
      questions: { data: {}, error: null },
    });
    const { createPackQuiz } = await import('@/app/actions/quizzes');
    const quiz = await createPackQuiz('warmup');
    expect(quiz.title).toBe('تسخين الحصة');
    expect(host.lastInsert('quizzes')).toMatchObject({
      host_id: 'host-1',
      title: 'تسخين الحصة',
    });
    const rows = host.lastInsert('questions') as { prompt: string }[];
    expect(rows).toHaveLength(8);
    expect(rows[0].prompt).toContain('مصر');
  });

  it('reuses an existing share code', async () => {
    host.setTable('quizzes', { data: { id: 'q1', share_code: 'ABCD2345' }, error: null });
    const { enableQuizShare } = await import('@/app/actions/quizzes');
    await expect(enableQuizShare('q1')).resolves.toEqual({ shareCode: 'ABCD2345' });
  });
});
