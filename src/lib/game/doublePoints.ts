const INDEX_TOKEN = /^(?:0|[1-9]\d*)$/;

export interface DoublePointsQuestion {
  id?: string | null;
  order_index?: number | null;
}

/**
 * `double_points_rounds` stores question ids. Older quizzes stored the editor
 * position ("3"). That position is the question's library order, never the
 * shuffled play slot.
 */
export function doublePointsQuestionIds(
  rounds: unknown,
  questions: readonly DoublePointsQuestion[]
): string[] {
  if (!Array.isArray(rounds)) return [];
  const known = new Set(
    questions.map((question) => question.id).filter((id): id is string => Boolean(id))
  );
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };

  for (const raw of rounds) {
    const value = String(raw);
    if (known.has(value)) {
      add(value);
      continue;
    }
    if (!INDEX_TOKEN.test(value)) continue;
    const index = Number(value);
    const match = questions.find((question) => question.order_index === index) ?? questions[index];
    add(match?.id);
  }
  return out;
}

/** Point saved doubles at the new question ids created by a clone or import. */
export function remapDoublePointsRounds(
  rounds: unknown,
  sourceQuestions: readonly DoublePointsQuestion[],
  nextIdBySourceId: ReadonlyMap<string, string>
): string[] {
  return doublePointsQuestionIds(rounds, sourceQuestions)
    .map((id) => nextIdBySourceId.get(id))
    .filter((id): id is string => Boolean(id));
}
