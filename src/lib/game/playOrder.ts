/**
 * current_question_index is a position in game_sessions.question_order, and
 * that is how phones (/api/player/current-question) and Postgres
 * (submit_live_answer) both resolve the live question.
 *
 * The host must resolve it the same way. Indexing its own question array
 * instead is what desyncs a room: questionsInPlayOrder drops ids that are no
 * longer in the quiz, so one deleted question shifts every later position and
 * the projector starts showing a different question than the phones.
 */

/** The question at a session index, resolved by id exactly like the phones do. */
export function activeQuestionForIndex<T extends { id: string }>(
  questions: readonly T[],
  order: unknown,
  index: number
): T | null {
  const ids = Array.isArray(order) && order.length > 0 ? order : null;
  if (!ids) return questions[index] ?? null;
  const id = ids[index];
  if (typeof id !== 'string') return null;
  return questions.find((question) => question.id === id) ?? null;
}

/** Session index to write when jumping, so the phones land on the same question. */
export function sessionIndexForQuestion(
  order: unknown,
  questionId: string,
  fallbackIndex: number
): number {
  const ids = Array.isArray(order) && order.length > 0 ? order : null;
  if (!ids) return fallbackIndex;
  const found = ids.findIndex((id) => id === questionId);
  return found >= 0 ? found : fallbackIndex;
}

/** How many questions this session will play — the sealed order, not the quiz. */
export function sessionQuestionCount(order: unknown, questionCount: number): number {
  const ids = Array.isArray(order) && order.length > 0 ? order : null;
  return ids ? ids.length : questionCount;
}

/** True when the session index is the last one in the sealed order. */
export function isLastSessionIndex(order: unknown, questionCount: number, index: number): boolean {
  return index >= sessionQuestionCount(order, questionCount) - 1;
}
