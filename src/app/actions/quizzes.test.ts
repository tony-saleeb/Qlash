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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    throw new Error('admin client should not run for a repeat import');
  }),
}));

const host = createClientMock({ id: 'host-1', email: 'host@qlash.test' });

function quizSettings(expectedUpdatedAt: string) {
  return {
    title: 'Quiz',
    description: '',
    theme: DEFAULT_QUIZ_THEME,
    randomize_questions: false,
    randomize_answers: false,
    team_mode: false,
    double_points_rounds: [] as string[],
    expected_updated_at: expectedUpdatedAt,
  };
}

function editorQuestion(id: string, prompt: string) {
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
      { id: '1', text: 'A', is_correct: true, color: '#000', shape: 'slash' },
      { id: '2', text: 'B', is_correct: false, color: '#111', shape: 'qring' },
    ],
  };
}

function questionWrites() {
  return host.fromCalls
    .filter((entry) => entry.table === 'questions')
    .map((entry) => {
      const captured = (entry.chain as { _captured?: { method: string; args: unknown[] }[] })._captured ?? [];
      return {
        methods: captured.map((item) => item.method),
        payload: captured.find((item) => item.method === 'insert' || item.method === 'delete' || item.method === 'update')
          ?.args[0],
      };
    });
}

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

  it('hides a quiz instead of deleting the row and its past games', async () => {
    host.setTable('quizzes', { data: {}, error: null });
    const { deleteQuiz } = await import('@/app/actions/quizzes');
    await expect(deleteQuiz('q1')).resolves.toEqual({ success: true });
    expect(host.lastUpdate('quizzes')).toEqual({ deleted_at: expect.any(String) });
    const methods = host.fromCalls
      .filter((entry) => entry.table === 'quizzes')
      .flatMap((entry) => (entry.chain as { _captured?: { method: string }[] })._captured?.map((item) => item.method) ?? []);
    expect(methods).not.toContain('delete');
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
              id: 'q-old',
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
    const copiedQuestions = host.lastInsert('questions') as { id: string; quiz_id: string }[];
    expect(host.lastInsert('quizzes')).toMatchObject({
      host_id: 'host-1',
      title: 'Original (Copy)',
      team_mode: true,
      double_points_rounds: [copiedQuestions[0].id],
    });
    expect(copiedQuestions).toEqual([
      expect.objectContaining({ quiz_id: 'copy', prompt: 'Hi', order_index: 0 }),
    ]);
    expect(copiedQuestions[0].id).not.toBe('q-old');
  });

  it('rejects unauthenticated library access', async () => {
    host.auth.getClaims.mockResolvedValue({ data: null, error: { message: 'no' } });
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

  it('inserts a new question under the editor id and returns both ids', async () => {
    host.setTables({
      quizzes: { data: { updated_at: '2026-11-07T00:00:00.000Z' }, error: null },
      questions: [
        { data: [{ id: 'old' }], error: null },
        { data: [{ id: 'client-new', order_index: 1 }], error: null },
      ],
    });
    const { saveQuizData } = await import('@/app/actions/quizzes');
    const saved = await saveQuizData('quiz-1', quizSettings('2026-11-01T00:00:00.000Z'), [
      editorQuestion('old', 'Kept'),
      editorQuestion('client-new', 'Added'),
    ]);
    expect(saved.questionIds).toEqual(['old', 'client-new']);
    const inserted = questionWrites().find((call) => call.methods.includes('insert'));
    expect(inserted?.payload).toEqual([expect.objectContaining({ id: 'client-new', prompt: 'Added' })]);
  });

  it('archives a removed question instead of deleting its answers', async () => {
    host.setTables({
      quizzes: { data: { updated_at: '2026-11-07T00:00:02.000Z' }, error: null },
      questions: { data: [{ id: 'kept' }, { id: 'removed' }], error: null },
    });
    const { saveQuizData } = await import('@/app/actions/quizzes');
    await saveQuizData('quiz-1', quizSettings('2026-11-07T00:00:00.000Z'), [editorQuestion('kept', 'Kept')]);
    const updates = questionWrites()
      .filter((call) => call.methods.includes('update'))
      .map((call) => call.payload);
    expect(updates).toContainEqual({ archived_at: expect.any(String) });
    expect(questionWrites().some((call) => call.methods.includes('delete'))).toBe(false);
  });

  it('updates a question that already has an id instead of deleting and recreating it', async () => {
    host.setTables({
      quizzes: { data: { updated_at: '2026-11-07T00:00:01.000Z' }, error: null },
      questions: { data: [{ id: 'old' }, { id: 'client-new' }], error: null },
    });
    const { saveQuizData } = await import('@/app/actions/quizzes');
    const saved = await saveQuizData('quiz-1', quizSettings('2026-11-07T00:00:00.000Z'), [
      editorQuestion('old', 'Kept'),
      editorQuestion('client-new', 'Added'),
    ]);
    expect(saved.questionIds).toEqual(['old', 'client-new']);
    const writes = questionWrites();
    expect(writes.some((call) => call.methods.includes('delete'))).toBe(false);
    expect(writes.some((call) => call.methods.includes('insert'))).toBe(false);
  });

  it('rejects an mcq that has two correct answers', async () => {
    const broken = editorQuestion('old', 'Kept');
    broken.answers = [
      { id: '1', text: 'A', is_correct: true, color: '#000', shape: 'slash' },
      { id: '2', text: 'B', is_correct: true, color: '#111', shape: 'qring' },
    ];
    const { saveQuizData } = await import('@/app/actions/quizzes');
    await expect(saveQuizData('quiz-1', quizSettings('2026-11-01T00:00:00.000Z'), [broken])).rejects.toThrow(
      /exactly one correct/
    );
    expect(host.fromCalls).toHaveLength(0);
  });

  it('rejects a question whose answer options share an id', async () => {
    const broken = editorQuestion('old', 'Kept');
    broken.answers = [
      { id: '4', text: 'A', is_correct: true, color: '#000', shape: 'slash' },
      { id: '4', text: 'B', is_correct: false, color: '#111', shape: 'qring' },
    ];
    const { saveQuizData } = await import('@/app/actions/quizzes');
    await expect(saveQuizData('quiz-1', quizSettings('2026-11-01T00:00:00.000Z'), [broken])).rejects.toThrow(
      /share an id/
    );
    expect(host.fromCalls).toHaveLength(0);
  });

  it('does not touch questions when another tab saved the quiz first', async () => {
    host.setTables({
      quizzes: { data: null, error: null },
    });
    const { saveQuizData } = await import('@/app/actions/quizzes');
    await expect(
      saveQuizData('quiz-1', quizSettings('2026-11-01T00:00:00.000Z'), [editorQuestion('old', 'Kept')])
    ).rejects.toThrow(/Reload the page/);
    expect(questionWrites()).toHaveLength(0);
  });

  it('reuses an existing share code', async () => {
    host.setTable('quizzes', { data: { id: 'q1', share_code: 'ABCD2345' }, error: null });
    const { enableQuizShare } = await import('@/app/actions/quizzes');
    await expect(enableQuizShare('q1')).resolves.toEqual({ shareCode: 'ABCD2345' });
  });

  it('replaces a live share code and can clear it', async () => {
    host.setTable('quizzes', { data: { id: 'q1', share_code: 'ZZZZZZZZ' }, error: null });
    const { rotateQuizShare, stopQuizShare } = await import('@/app/actions/quizzes');
    await expect(rotateQuizShare('q1')).resolves.toEqual({ shareCode: 'ZZZZZZZZ' });
    expect(host.lastUpdate('quizzes')).toEqual({
      share_code: expect.stringMatching(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/),
    });

    host.reset();
    vi.mocked(createClient).mockReturnValue(host as never);
    host.setTable('quizzes', { data: { id: 'q1' }, error: null });
    await expect(stopQuizShare('q1')).resolves.toEqual({ shareCode: null });
    expect(host.lastUpdate('quizzes')).toEqual({ share_code: null });
  });

  it('rejects a share code that is not 6 to 12 letters or digits', async () => {
    const { importSharedQuiz } = await import('@/app/actions/quizzes');
    await expect(importSharedQuiz('nope')).rejects.toThrow(/Invalid share code/);
    expect(host.fromCalls.some((entry) => entry.table === 'quizzes')).toBe(false);
  });

  it('returns the copy this host already imported for the same share code', async () => {
    host.setTable('quizzes', { data: { id: 'existing-copy' }, error: null });
    const { importSharedQuiz } = await import('@/app/actions/quizzes');
    await expect(importSharedQuiz('abcd2345')).resolves.toEqual({ id: 'existing-copy' });
    const inserted = host.fromCalls
      .filter((entry) => entry.table === 'quizzes')
      .some((entry) =>
        ((entry.chain as { _captured?: { method: string }[] })._captured ?? []).some(
          (item) => item.method === 'insert'
        )
      );
    expect(inserted).toBe(false);
  });
});
