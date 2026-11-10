/** Answer ids the server already stored for this player, after a reload. */

export function restoredAnswerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function shouldLockRestoredAnswer(status: string, ids: readonly string[]): boolean {
  return (status === 'question_active' || status === 'question_paused') && ids.length > 0;
}

/** The reveal card shows the stored choice. Local memory is only a fallback. */
export function choiceIdsForReveal(localIds: readonly string[], serverIds: unknown): string[] {
  const restored = restoredAnswerIds(serverIds);
  return restored.length > 0 ? restored : [...localIds];
}
