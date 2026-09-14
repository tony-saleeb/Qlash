import type { GameSessionRow, PublicAnswerOption, PublicQuestionPayload } from '@/lib/game/types';

export function mergeLiveSession(prev: GameSessionRow, incoming: GameSessionRow): GameSessionRow {
  const incomingIndex = incoming.current_question_index;
  const prevIndex = prev.current_question_index;
  if (incomingIndex < prevIndex) return prev;

  if (incomingIndex === prevIndex) {
    const prevStart = prev.question_started_at ? Date.parse(prev.question_started_at) : NaN;
    const nextStart = incoming.question_started_at ? Date.parse(incoming.question_started_at) : NaN;
    if (Number.isFinite(prevStart) && (!Number.isFinite(nextStart) || nextStart < prevStart)) {
      return { ...incoming, question_started_at: prev.question_started_at };
    }
  }

  return incoming;
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
  if (answers.length === 0) return null;
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

export function isStaleHydrate(params: {
  liveIndex: number | null;
  hydrateIndex: unknown;
}): boolean {
  if (params.liveIndex === null) return false;
  if (typeof params.hydrateIndex !== 'number' || !Number.isFinite(params.hydrateIndex)) return false;
  return params.hydrateIndex < params.liveIndex;
}
