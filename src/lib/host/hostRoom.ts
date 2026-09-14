import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Player, Question, GameSessionRow } from '@/lib/game/types';
import { parseCreatedSession, toGameSessionRow } from '@/lib/host/createLobbySession';
import {
  HOST_PLAYER_SELECT,
  HOST_QUESTION_SELECT,
  HOST_QUIZ_SELECT,
  HOST_SESSION_SELECT,
  sortPlayersByJoin,
  unwrapOne,
  type HostQuizInfo,
} from '@/lib/host/hostRoomFields';

export {
  HOST_PLAYER_SELECT,
  HOST_QUESTION_SELECT,
  HOST_QUIZ_SELECT,
  HOST_SESSION_SELECT,
  unwrapOne,
  type HostQuizInfo,
};

export type HostRoomPayload = {
  session: GameSessionRow;
  quiz: HostQuizInfo;
  questions: Question[];
  players: Player[];
};

type HostClient = ReturnType<typeof createClient>;

function asPlayers(value: unknown): Player[] {
  if (!Array.isArray(value)) return [];
  return sortPlayersByJoin(
    value.filter((row): row is Player => {
      if (!row || typeof row !== 'object') return false;
      const player = row as Player;
      return typeof player.id === 'string' && typeof player.nickname === 'string';
    })
  );
}

function asQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Question => {
    if (!row || typeof row !== 'object') return false;
    const question = row as Question;
    return typeof question.id === 'string' && typeof question.prompt === 'string';
  });
}

type NestedSessionRow = Record<string, unknown> & {
  host_id?: string;
  quizzes?: HostQuizInfo | HostQuizInfo[] | null;
  players?: Player[] | null;
};

export async function loadHostRoom(
  supabase: HostClient,
  user: User,
  sessionId: string
): Promise<HostRoomPayload | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select(`${HOST_SESSION_SELECT}, quizzes (${HOST_QUIZ_SELECT}), players (${HOST_PLAYER_SELECT})`)
    .eq('id', sessionId)
    .single();

  if (error || !data) return null;

  const nested = data as NestedSessionRow;
  const session = parseCreatedSession(nested);
  if (!session || session.host_id !== user.id) return null;

  const quiz = unwrapOne(nested.quizzes);
  if (!quiz?.id || !quiz.title) return null;

  const players = asPlayers(nested.players);
  const needsQuestions = session.status !== 'lobby';
  let questions: Question[] = [];
  if (needsQuestions && session.quiz_id) {
    const questionsResult = await supabase
      .from('questions')
      .select(HOST_QUESTION_SELECT)
      .eq('quiz_id', session.quiz_id)
      .order('order_index', { ascending: true });
    if (questionsResult.error) {
      console.error('Error fetching questions:', questionsResult.error);
    }
    questions = asQuestions(questionsResult.data);
  }

  return {
    session: toGameSessionRow(session),
    quiz,
    questions,
    players,
  };
}
