import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultQuestion } from '@/app/dashboard/quizzes/[id]/edit/quizEditorModel';
import QuestionEditorPane from '@/app/dashboard/quizzes/[id]/edit/QuestionEditorPane';

describe('true/false labels', () => {
  it('lets the host edit both labels', async () => {
    const onUpdateAnswer = vi.fn();
    const onToggleCorrect = vi.fn();
    const question = createDefaultQuestion('true_false', 'ar');
    question.answers[0].is_correct = true;
    render(
      <QuestionEditorPane
        quizId="quiz-1"
        activeQuestion={question}
        isDoublePointsRound={false}
        onTypeChange={vi.fn()}
        onUpdate={vi.fn()}
        onMedia={vi.fn()}
        onToggleDoublePoints={vi.fn()}
        onUpdateAnswer={onUpdateAnswer}
        onToggleCorrect={onToggleCorrect}
        onAddAnswer={vi.fn()}
        onRemoveAnswer={vi.fn()}
      />
    );

    const correct = screen.getByDisplayValue('صح');
    const wrong = screen.getByDisplayValue('خطأ');
    expect(correct).toBeEnabled();
    expect(wrong).toBeEnabled();
    await userEvent.type(correct, 'ح');
    expect(onUpdateAnswer).toHaveBeenCalledWith(0, expect.stringContaining('صح'));

    const marks = screen.getAllByRole('button', { name: 'Mark as Correct answer' });
    expect(marks.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    await userEvent.click(marks[1]);
    expect(onToggleCorrect).toHaveBeenCalledWith(1);
  });
});