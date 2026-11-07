import type { AnswerOption } from '@/lib/game/types';

export type LiveAnswerText = { id: string; text: string };

export type LiveQuestionEdit = {
  prompt: string;
  answers: LiveAnswerText[];
};

type EditableQuestion = {
  id: string;
  prompt: string;
  answers: AnswerOption[];
};

/**
 * Paint edited wording onto the stored answer list. The list on screen may be
 * shuffled; the saved row keeps the quiz's original order and correctness.
 */
export function applyLiveQuestionEdit<T extends EditableQuestion>(
  stored: T,
  edit: LiveQuestionEdit
): T {
  const textById = new Map(edit.answers.map((answer) => [answer.id, answer.text]));
  return {
    ...stored,
    prompt: edit.prompt,
    answers: stored.answers.map((answer) => {
      const text = textById.get(answer.id);
      return text === undefined ? answer : { ...answer, text };
    }),
  };
}

/** Host broadcast. Answer text only, so a phone cannot read the key from the event. */
export function questionUpdatePayload(question: EditableQuestion): Record<string, unknown> {
  return {
    question_id: question.id,
    prompt: question.prompt,
    answers: question.answers.map((answer) => ({ id: answer.id, text: answer.text })),
  };
}

export function questionEditFromUpdate(
  payload: Record<string, unknown> | null | undefined
): (LiveQuestionEdit & { questionId: string }) | null {
  if (!payload || typeof payload.question_id !== 'string' || typeof payload.prompt !== 'string') {
    return null;
  }
  if (!Array.isArray(payload.answers)) return null;
  const answers: LiveAnswerText[] = [];
  for (const row of payload.answers) {
    if (!row || typeof row !== 'object') return null;
    const item = row as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.text !== 'string') return null;
    answers.push({ id: item.id, text: item.text });
  }
  return { questionId: payload.question_id, prompt: payload.prompt, answers };
}

/** Same array when the event does not apply, so a listener can skip a render. */
export function patchQuestionBank<T extends EditableQuestion>(
  questions: readonly T[],
  payload: Record<string, unknown> | null | undefined
): readonly T[] {
  const edit = questionEditFromUpdate(payload);
  if (!edit) return questions;
  const index = questions.findIndex((question) => question.id === edit.questionId);
  if (index < 0) return questions;
  const next = questions.slice();
  next[index] = applyLiveQuestionEdit(questions[index], edit);
  return next;
}
