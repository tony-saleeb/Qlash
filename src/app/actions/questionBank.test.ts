import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const host = createClientMock({ id: 'host-1', email: 'host@qlash.test' });

const stored = [
  { prompt: 'One?', answers: [{ text: 'A', correct: true }, { text: 'B', correct: false }] },
  { prompt: 'Two?', answers: [{ text: 'C', correct: false }, { text: 'D', correct: true }] },
  { prompt: 'Three?', answers: [{ text: 'E', correct: true }, { text: 'F', correct: false }] },
];

describe('question bank actions', () => {
  beforeEach(() => {
    host.reset();
    vi.mocked(createClient).mockReturnValue(host as never);
  });

  it('draws the requested questions into a new quiz', async () => {
    host.setTables({
      hosts: { data: { plan: 'free' }, error: null },
      quizzes: [
        { data: null, error: null, count: 1 },
        {
          data: {
            id: 'quiz-9',
            title: 'Sunday',
            description: '',
            created_at: '2026-11-13T00:00:00.000Z',
          },
          error: null,
        },
      ],
      question_banks: { data: { id: 'bank-1', name: 'Sunday' }, error: null },
      bank_questions: { data: stored, error: null },
      questions: { data: null, error: null },
    });
    const { drawQuizFromBank } = await import('@/app/actions/questionBank');
    const quiz = await drawQuizFromBank('bank-1', 2, () => 0);
    expect(quiz).toMatchObject({ id: 'quiz-9', title: 'Sunday', questionCount: 2 });
    expect(host.lastInsert('quizzes')).toMatchObject({ host_id: 'host-1', title: 'Sunday' });
    const rows = host.lastInsert('questions') as { prompt: string; quiz_id: string }[];
    expect(rows.map((row) => row.prompt)).toEqual(['Two?', 'Three?']);
    expect(rows.every((row) => row.quiz_id === 'quiz-9')).toBe(true);
  });

  it('does not create a quiz when the category is short', async () => {
    host.setTables({
      hosts: { data: { plan: 'free' }, error: null },
      quizzes: { data: null, error: null, count: 0 },
      question_banks: { data: { id: 'bank-1', name: 'Sunday' }, error: null },
      bank_questions: { data: stored, error: null },
    });
    const { drawQuizFromBank } = await import('@/app/actions/questionBank');
    await expect(drawQuizFromBank('bank-1', 5, () => 0)).rejects.toThrow(/only has 3/);
    expect(host.lastInsert('quizzes')).toBeUndefined();
  });

  it('does not draw when the quiz library is full', async () => {
    host.setTables({
      hosts: { data: { plan: 'free' }, error: null },
      quizzes: { data: null, error: null, count: 5 },
    });
    const { drawQuizFromBank } = await import('@/app/actions/questionBank');
    await expect(drawQuizFromBank('bank-1', 1, () => 0)).rejects.toThrow(/5 saved quizzes/);
    expect(host.lastInsert('quizzes')).toBeUndefined();
  });

  it('stores a trimmed question with one correct answer', async () => {
    host.setTables({
      question_banks: { data: { id: 'bank-1' }, error: null },
      bank_questions: [
        { data: null, error: null, count: 0 },
        { data: { id: 'q-1', prompt: 'Where?' }, error: null },
      ],
    });
    const { addBankQuestion } = await import('@/app/actions/questionBank');
    const saved = await addBankQuestion('bank-1', '  Where? ', [
      { text: ' Cairo ', correct: true },
      { text: ' ', correct: false },
      { text: 'Alex', correct: false },
    ]);
    expect(saved).toEqual({ id: 'q-1', prompt: 'Where?' });
    expect(host.lastInsert('bank_questions')).toMatchObject({
      bank_id: 'bank-1',
      prompt: 'Where?',
      answers: [
        { text: 'Cairo', correct: true },
        { text: 'Alex', correct: false },
      ],
    });
  });
});
