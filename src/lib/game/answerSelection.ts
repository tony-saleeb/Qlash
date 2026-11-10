/** Typed answers and choice ids share one cap. A uuid id is 36 characters. */
export const MAX_ANSWER_TEXT = 80;

/**
 * Shape check that does not need the question type. Duplicates are never a
 * legal vote: polls and single-choice take one id, multi-select takes distinct ids.
 * Returns the trimmed values, or null when the payload must be rejected.
 */
export function cleanAnswerSelection(selected: unknown): string[] | null {
  if (!Array.isArray(selected) || selected.length === 0 || selected.length > 6) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of selected) {
    if (typeof item !== 'string') return null;
    const text = item.trim();
    if (text.length === 0 || text.length > MAX_ANSWER_TEXT || seen.has(text)) return null;
    seen.add(text);
    out.push(text);
  }
  return out;
}

/** Type-aware rule used by the live grader. Choice ids must belong to the question. */
export function selectionMatchesQuestion(
  type: string,
  answerIds: readonly string[],
  selected: readonly string[]
): boolean {
  const known = new Set(answerIds);
  if (type === 'type_answer') return selected.length === 1;
  if (type === 'multi_select') {
    return selected.length > 0 && selected.every((id) => known.has(id));
  }
  if (type === 'mcq' || type === 'true_false' || type === 'poll') {
    return selected.length === 1 && known.has(selected[0]);
  }
  return false;
}
