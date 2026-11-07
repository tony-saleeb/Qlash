/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultQuestion } from '@/app/dashboard/quizzes/[id]/edit/quizEditorModel';
import type { Question } from '@/app/dashboard/quizzes/[id]/edit/quizEditorModel';

const saveQuizData = vi.hoisted(() =>
  vi.fn(async () => ({ success: true as const, updatedAt: '2026-08-13T20:00:00.000Z', questionIds: ['q1', 'q2'] }))
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/host/hostApi', () => ({ saveQuizData }));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast'),
    warning: vi.fn(),
  },
}));

import QuizEditorClient from '@/app/dashboard/quizzes/[id]/edit/QuizEditorClient';

function ready(id: string, prompt: string): Question {
  const question = createDefaultQuestion('mcq');
  question.id = id;
  question.prompt = prompt;
  question.answers = question.answers.map((answer, index) => ({
    ...answer,
    text: `Option ${index + 1}`,
    is_correct: index === 0,
  }));
  return question;
}

const quiz = {
  id: 'quiz-1',
  title: 'Geo',
  description: '',
  theme: {},
  randomize_questions: false,
  randomize_answers: false,
  team_mode: false,
  double_points_rounds: [],
  updated_at: '2026-08-13T19:00:00.000Z',
};

describe('editor save and reorder', () => {
  beforeEach(() => {
    saveQuizData.mockClear();
    localStorage.removeItem('qlash_locale');
    document.cookie = 'qlash_locale=; path=/; max-age=0';
  });

  it('saves the questions in the order the host moved them', async () => {
    const user = userEvent.setup();
    render(
      <QuizEditorClient quiz={quiz} initialQuestions={[ready('q1', 'Alpha'), ready('q2', 'Beta')]} />
    );
    await user.click(screen.getByRole('button', { name: 'Move question 1 down' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveQuizData).toHaveBeenCalledTimes(1);
    const savedQuestions = saveQuizData.mock.calls[0][2] as Question[];
    expect(savedQuestions.map((question) => question.prompt)).toEqual(['Beta', 'Alpha']);
    expect(saveQuizData.mock.calls[0][0]).toBe('quiz-1');
  });

  it('uses Arabic chrome and a logical sidebar edge', async () => {
    localStorage.setItem('qlash_locale', 'ar');
    render(
      <QuizEditorClient quiz={quiz} initialQuestions={[ready('q1', 'Alpha')]} />
    );
    expect(await screen.findByText('الأسئلة')).toBeTruthy();
    const aside = document.querySelector('aside');
    expect(aside?.className).toContain('md:border-e');
    expect(aside?.className.includes('md:border-r')).toBe(false);
  });

  it('selects a question from the keyboard and names the settings switches', async () => {
    const user = userEvent.setup();
    render(
      <QuizEditorClient quiz={quiz} initialQuestions={[ready('q1', 'Alpha'), ready('q2', 'Beta')]} />
    );
    const beta = screen.getByRole('button', { name: /Beta/ });
    beta.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('switch', { name: 'Randomize Question Order' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Randomize Answer Order' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Team Mode Activation' })).toBeInTheDocument();
  });
});
