/** A removed question stays in the database so past answers are not cascaded away. */

export function questionOrderIds(order: unknown): string[] {
  if (!Array.isArray(order)) return [];
  return order.filter((id): id is string => typeof id === 'string');
}

/** Lobby and new games skip archived rows. A live room keeps one it already started. */
export function keepStoredQuestion(
  question: { id: string; archived_at?: string | null },
  questionOrder: readonly string[]
): boolean {
  if (!question.archived_at) return true;
  return questionOrder.includes(question.id);
}

/** Reports still show a removed question when this class was asked it or someone answered it. */
export function questionsForReport<T extends { id: string; archived_at?: string | null }>(
  questions: readonly T[],
  answers: readonly { question_id: string }[],
  questionOrder: readonly string[]
): T[] {
  const answered = new Set(answers.map((answer) => answer.question_id));
  return questions.filter(
    (question) => !question.archived_at || questionOrder.includes(question.id) || answered.has(question.id)
  );
}
