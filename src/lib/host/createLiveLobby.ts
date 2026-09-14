import { getHostAuth } from '@/lib/supabase/hostAuth';
import { DEFAULT_LATE_JOIN_THROUGH_INDEX } from '@/lib/game/lateJoin';
import { randomLivePin } from '@/lib/game/livePin';
import {
  isMissingCreateLobbyRpc,
  parseCreatedSession,
  SESSION_RETURNING,
  type CreatedLiveSession,
} from '@/lib/host/createLobbySession';

export type { CreatedLiveSession };
export { isMissingCreateLobbyRpc, parseCreatedSession, toGameSessionRow } from '@/lib/host/createLobbySession';

export async function createLiveLobby(quizId: string): Promise<CreatedLiveSession> {
  const { supabase, user } = await getHostAuth();

  const { data, error } = await supabase.rpc('create_live_lobby', { p_quiz_id: quizId });
  const fromRpc = parseCreatedSession(data);
  if (fromRpc) return fromRpc;
  if (!isMissingCreateLobbyRpc(error)) {
    throw new Error(error?.message || 'Failed to start game room.');
  }

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id')
    .eq('id', quizId)
    .eq('host_id', user.id)
    .single();

  if (quizError || !quiz) {
    throw new Error('Quiz not found or unauthorized.');
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const pin = randomLivePin();
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        quiz_id: quizId,
        host_id: user.id,
        pin,
        status: 'lobby',
        current_question_index: 0,
        active_multiplier: 1,
        late_join_through_index: DEFAULT_LATE_JOIN_THROUGH_INDEX,
      })
      .select(SESSION_RETURNING)
      .single();

    const created = parseCreatedSession(session);
    if (created) return created;
    if ((sessionError as { code?: string } | null)?.code === '23505') continue;
    throw sessionError || new Error('Failed to create game session.');
  }

  throw new Error('Failed to generate a unique PIN code. Please try again.');
}
