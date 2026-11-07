import type { GameSessionRow, PublicAnswerOption, PublicQuestionPayload } from '@/lib/game/types';

export function mergeLiveSession(prev: GameSessionRow, incoming: GameSessionRow): GameSessionRow {
  const incomingIndex = incoming.current_question_index;
  const prevIndex = prev.current_question_index;
  if (incomingIndex < prevIndex) return prev;

  if (incomingIndex === prevIndex && incoming.status !== 'question_paused') {
    const prevStart = prev.question_started_at ? Date.parse(prev.question_started_at) : NaN;
    const nextStart = incoming.question_started_at ? Date.parse(incoming.question_started_at) : NaN;
    if (Number.isFinite(prevStart) && (!Number.isFinite(nextStart) || nextStart < prevStart)) {
      return { ...incoming, question_started_at: prev.question_started_at };
    }
  }

  return incoming;
}

/** The host's own Start / Next / Jump. Realtime merges must not rewind this. */
export function hostQuestionSession(
  prev: GameSessionRow,
  nextIndex: number,
  serverStartedAt: string | null
): GameSessionRow {
  return {
    ...prev,
    status: 'question_active',
    current_question_index: nextIndex,
    question_started_at: serverStartedAt,
    active_multiplier: 1,
  };
}

/** Never rewind the live clock to an earlier stamp for the same question. */
export function shouldAcceptQuestionClock(current: string | null, incoming: string | null): boolean {
  if (!incoming) return false;
  if (!current) return true;
  const previous = Date.parse(current);
  const next = Date.parse(incoming);
  if (!Number.isFinite(next)) return false;
  if (!Number.isFinite(previous)) return true;
  return next >= previous;
}

function asPublicAnswer(value: unknown): PublicAnswerOption | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.text !== 'string') return null;
  return {
    id: row.id,
    text: row.text,
    color: typeof row.color === 'string' ? row.color : '',
    shape: typeof row.shape === 'string' ? row.shape : '',
  };
}

/** Public question from the host's question:start broadcast — no correctness flags. */
export function publicQuestionFromStartPayload(
  payload: Record<string, unknown>
): PublicQuestionPayload | null {
  if (typeof payload.question_id !== 'string') return null;
  if (typeof payload.type !== 'string' || typeof payload.prompt !== 'string') return null;
  if (typeof payload.time_limit_seconds !== 'number' || !Number.isFinite(payload.time_limit_seconds)) {
    return null;
  }
  if (!Array.isArray(payload.answers)) return null;
  const answers = payload.answers
    .map(asPublicAnswer)
    .filter((row): row is PublicAnswerOption => row !== null);
  if (answers.length === 0 && payload.type !== 'type_answer') return null;
  return {
    id: payload.question_id,
    type: payload.type,
    prompt: payload.prompt,
    media_url: typeof payload.media_url === 'string' ? payload.media_url : null,
    media_type: typeof payload.media_type === 'string' ? payload.media_type : null,
    time_limit_seconds: payload.time_limit_seconds,
    answers,
  };
}

/**
 * A repeat payload for the question already on screen keeps the buttons where
 * the player sees them; only text and marks update. A different answer set is
 * a real change and comes through as sent.
 */
export function keepAnswerLayout(
  current: PublicQuestionPayload | null,
  incoming: PublicQuestionPayload
): PublicQuestionPayload {
  if (!current || current.id !== incoming.id) return incoming;
  if (current.answers.length !== incoming.answers.length) return incoming;
  const byId = new Map(incoming.answers.map((answer) => [answer.id, answer]));
  const answers: PublicAnswerOption[] = [];
  for (const shown of current.answers) {
    const next = byId.get(shown.id);
    if (!next) return incoming;
    answers.push(next);
  }
  return { ...incoming, answers };
}

export function isStaleHydrate(params: {
  liveIndex: number | null;
  hydrateIndex: unknown;
}): boolean {
  if (params.liveIndex === null) return false;
  if (typeof params.hydrateIndex !== 'number' || !Number.isFinite(params.hydrateIndex)) return false;
  return params.hydrateIndex < params.liveIndex;
}
