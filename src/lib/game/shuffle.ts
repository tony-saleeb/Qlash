/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function maybeShuffle<T>(items: readonly T[], enabled: boolean): T[] {
  return enabled ? shuffle(items) : [...items];
}

/** FNV-1a 32-bit — stable across host broadcast and player hydrate. */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic shuffle so hydrate matches the host without a DB write. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items];
  let state = hashSeed(seed) || 1;
  const rand = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function maybeSeededShuffle<T>(items: readonly T[], enabled: boolean, seed: string): T[] {
  return enabled ? seededShuffle(items, seed) : [...items];
}

/** Rebuild play order from persisted question_order so projector and clicker match. */
export function questionsInPlayOrder<T extends { id: string }>(
  questions: readonly T[],
  order: unknown
): T[] {
  if (!Array.isArray(order) || order.length === 0) return [...questions];
  const byId = new Map(questions.map((question) => [question.id, question]));
  const ordered: T[] = [];
  for (const id of order) {
    if (typeof id !== 'string') continue;
    const question = byId.get(id);
    if (!question) continue;
    ordered.push(question);
    byId.delete(id);
  }
  for (const leftover of byId.values()) ordered.push(leftover);
  return ordered;
}
