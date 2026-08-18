import { resolveAnswerColor, resolveMarkId } from '@/lib/game/marks';

export type GameStatus =
  | 'lobby'
  | 'question_active'
  | 'question_paused'
  | 'question_reveal'
  | 'leaderboard'
  | 'finished';

export interface AnswerOption {
  id: string;
  text: string;
  color: string;
  shape: string;
  is_correct?: boolean;
  image_url?: string;
}

/** Player-safe answer option (no correctness flag). */
export interface PublicAnswerOption {
  id: string;
  text: string;
  color: string;
  shape: string;
}

export interface Question {
  id: string;
  type: string;
  prompt: string;
  media_url: string | null;
  media_type: string | null;
  time_limit_seconds: number;
  points_base: number;
  scoring_type: string;
  answers: AnswerOption[];
}

export interface PublicQuestionPayload {
  id: string;
  type: string;
  prompt: string;
  media_url: string | null;
  media_type: string | null;
  time_limit_seconds: number;
  answers: PublicAnswerOption[];
}

export interface Player {
  id: string;
  session_id: string;
  nickname: string;
  team_name?: string | null;
  score: number;
  streak: number;
  joined_at: string;
  connected: boolean;
}

export interface LeaderboardPlayer {
  id: string;
  nickname: string;
  score: number;
  streak: number;
  connected: boolean;
}

export interface GameSessionRow {
  id: string;
  pin: string;
  status: string;
  current_question_index: number;
  question_started_at: string | null;
  quiz_id: string;
  active_multiplier?: number;
  question_order?: string[] | null;
  late_join_through_index?: number | null;
}

export function sanitizeAnswers(answers: AnswerOption[]): PublicAnswerOption[] {
  return answers.map((ans) => ({
    id: ans.id,
    text: ans.text,
    color: resolveAnswerColor(ans.color),
    shape: resolveMarkId(ans.shape),
  }));
}

export function toPublicQuestion(question: Question): PublicQuestionPayload {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    media_url: question.media_url,
    media_type: question.media_type,
    time_limit_seconds: question.time_limit_seconds,
    answers: sanitizeAnswers(question.answers),
  };
}

export function buildQuestionStartPayload(
  question: Question,
  questionIndex: number,
  serverStartedAt: string
) {
  return {
    question_id: question.id,
    question_index: questionIndex,
    type: question.type,
    prompt: question.prompt,
    media_url: question.media_url,
    media_type: question.media_type,
    time_limit_seconds: question.time_limit_seconds,
    answers: sanitizeAnswers(question.answers),
    server_started_at: serverStartedAt,
  };
}
