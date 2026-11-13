/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addBankQuestion,
  createQuestionBank,
  drawQuizFromBank,
  listBankQuestions,
  listQuestionBanks,
} from '@/lib/host/hostApi';
import { QuestionBankDialog } from '@/app/dashboard/QuestionBankDialog';

vi.mock('@/lib/host/hostApi', () => ({
  listQuestionBanks: vi.fn(async () => []),
  createQuestionBank: vi.fn(async (name: string) => ({ id: 'bank-1', name, count: 0 })),
  deleteQuestionBank: vi.fn(),
  listBankQuestions: vi.fn(async () => []),
  addBankQuestion: vi.fn(async (_bankId: string, prompt: string) => ({
    id: 'q-1',
    prompt: prompt.trim(),
  })),
  deleteBankQuestion: vi.fn(),
  drawQuizFromBank: vi.fn(async () => ({
    id: 'quiz-1',
    title: 'Sunday school',
    description: '',
    created_at: '2026-11-13T00:00:00.000Z',
    questionCount: 1,
  })),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'toast') },
}));

const drawn = {
  id: 'quiz-1',
  title: 'Sunday school',
  description: '',
  created_at: '2026-11-13T00:00:00.000Z',
  questionCount: 1,
};

describe('question bank dialog', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listQuestionBanks).mockReset();
    vi.mocked(listQuestionBanks).mockResolvedValue([]);
    vi.mocked(createQuestionBank).mockClear();
    vi.mocked(listBankQuestions).mockReset();
    vi.mocked(listBankQuestions).mockResolvedValue([]);
    vi.mocked(addBankQuestion).mockClear();
    vi.mocked(drawQuizFromBank).mockClear();
  });

  it('saves a question in a category and draws one quiz question', async () => {
    const user = userEvent.setup();
    const onQuizCreated = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <QuestionBankDialog
        open
        onOpenChange={onOpenChange}
        atQuizCap={false}
        onQuizCap={vi.fn()}
        onQuizCreated={onQuizCreated}
      />
    );

    expect(await screen.findByText('Add a category first.')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Sunday school'), 'Sunday school');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    expect(await screen.findByRole('button', { name: /Sunday school/ })).toBeInTheDocument();
    expect(await screen.findByText('No questions in this category yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Question Prompt'), 'Where is Cairo?');
    await user.type(screen.getByPlaceholderText('Answer 1'), 'Cairo');
    await user.type(screen.getByPlaceholderText('Answer 2'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Add Question' }));

    expect(await screen.findByText('Where is Cairo?')).toBeInTheDocument();
    expect(addBankQuestion).toHaveBeenCalledWith('bank-1', 'Where is Cairo?', [
      { text: 'Cairo', correct: true },
      { text: 'Alex', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
    ]);

    await user.click(screen.getByRole('button', { name: 'Make quiz' }));
    expect(drawQuizFromBank).toHaveBeenCalledWith('bank-1', 1);
    expect(onQuizCreated).toHaveBeenCalledWith(drawn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the library cap when making a quiz and still lets questions be saved', async () => {
    vi.mocked(listQuestionBanks).mockResolvedValue([{ id: 'bank-1', name: 'Sunday', count: 3 }]);
    vi.mocked(listBankQuestions).mockResolvedValue([{ id: 'q-1', prompt: 'One?' }]);
    const user = userEvent.setup();
    const onQuizCap = vi.fn();
    render(
      <QuestionBankDialog
        open
        onOpenChange={vi.fn()}
        atQuizCap
        onQuizCap={onQuizCap}
        onQuizCreated={vi.fn()}
      />
    );

    expect(await screen.findByText('One?')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Question Prompt'), 'Another?');
    expect(screen.getByRole('button', { name: 'Add Question' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Make quiz' }));
    expect(onQuizCap).toHaveBeenCalledOnce();
    expect(drawQuizFromBank).not.toHaveBeenCalled();
  });
});
