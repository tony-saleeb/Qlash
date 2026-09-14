import type { GameSessionRow } from '@/lib/game/types';
import { DEFAULT_LATE_JOIN_THROUGH_INDEX } from '@/lib/game/lateJoin';

export type CreatedLiveSession = GameSessionRow & { host_id: string };

function asQuestionOrder(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((id): id is string => typeof id === 'string');
  return ids.length > 0 ? ids : null;
}

export function parseCreatedSession(data: unknown): CreatedLiveSession | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.pin !== 'string') return null;
  return {
    id: row.id,
    pin: row.pin,
    status: typeof row.status === 'string' ? row.status : 'lobby',
    current_question_index:
      typeof row.current_question_index === 'number' ? row.current_question_index : 0,
    question_started_at: typeof row.question_started_at === 'string' ? row.question_started_at : null,
    quiz_id: typeof row.quiz_id === 'string' ? row.quiz_id : '',
    host_id: typeof row.host_id === 'string' ? row.host_id : '',
    active_multiplier: typeof row.active_multiplier === 'number' ? row.active_multiplier : 1,
    question_order: asQuestionOrder(row.question_order),
    late_join_through_index:
      typeof row.late_join_through_index === 'number' ? row.late_join_through_index : DEFAULT_LATE_JOIN_THROUGH_INDEX,
  };
}

export function isMissingCreateLobbyRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return true;
  const code = error.code ?? '';
  const message = error.message ?? '';
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /could not find the function|create_live_lobby does not exist/i.test(message)
  );
}

export function toGameSessionRow(row: CreatedLiveSession | GameSessionRow): GameSessionRow {
  return {
    id: row.id,
    pin: row.pin,
    status: row.status,
    current_question_index: row.current_question_index,
    question_started_at: row.question_started_at,
    quiz_id: row.quiz_id,
    active_multiplier: row.active_multiplier,
    question_order: row.question_order ?? null,
    late_join_through_index: row.late_join_through_index ?? DEFAULT_LATE_JOIN_THROUGH_INDEX,
  };
}

export const SESSION_RETURNING =
  'id, pin, status, current_question_index, question_started_at, quiz_id, host_id, active_multiplier, question_order, late_join_through_index';
