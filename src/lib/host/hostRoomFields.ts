import type { Player } from '@/lib/game/types';

export const HOST_SESSION_SELECT =
  'id, pin, status, current_question_index, question_started_at, quiz_id, host_id, active_multiplier, question_order, late_join_through_index';

export const HOST_QUIZ_SELECT = 'id, title, randomize_questions, randomize_answers, team_mode';

export const HOST_PLAYER_SELECT = 'id, session_id, nickname, team_name, score, streak, joined_at, connected';

export const HOST_QUESTION_SELECT =
  'id, type, prompt, media_url, media_type, time_limit_seconds, points_base, scoring_type, answers, order_index';

export type HostQuizInfo = {
  id: string;
  title: string;
  randomize_questions?: boolean;
  randomize_answers?: boolean;
  team_mode?: boolean;
};

export function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function sortPlayersByJoin(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
}
