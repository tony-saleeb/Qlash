'use server';

import { getHostAuth } from '@/lib/supabase/hostAuth';
import { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_LATE_JOIN_THROUGH_INDEX } from '@/lib/game/lateJoin';

async function generateUniquePin(supabase: SupabaseClient): Promise<string> {
  let pin = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    pin = Math.floor(100000 + Math.random() * 900000).toString();

    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('pin', pin)
      .neq('status', 'finished')
      .maybeSingle();

    if (!data && !error) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate a unique PIN code. Please try again.');
  }

  return pin;
}

export async function createGameSession(quizId: string) {
  try {
    const { supabase, user } = await getHostAuth();

    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id')
      .eq('id', quizId)
      .eq('host_id', user.id)
      .single();

    if (quizError || !quiz) {
      throw new Error('Quiz not found or unauthorized.');
    }

    const pin = await generateUniquePin(supabase);

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
      .select()
      .single();

    if (sessionError || !session) {
      throw sessionError || new Error('Failed to create game session.');
    }

    return session;
  } catch (err) {
    console.error('createGameSession error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to start game room.');
  }
}

export async function endGameSession(sessionId: string) {
  try {
    const { supabase, user } = await getHostAuth();

    const { error } = await supabase
      .from('game_sessions')
      .update({ status: 'finished' })
      .eq('id', sessionId)
      .eq('host_id', user.id);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error('endGameSession error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to terminate game room.');
  }
}

export async function kickPlayer(playerId: string, sessionId: string) {
  try {
    const { supabase, user } = await getHostAuth();

    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (sessionError || !session) {
      throw new Error('Unauthorized or session not found.');
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
      .eq('session_id', sessionId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error('kickPlayer error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to kick player.');
  }
}

export async function updatePlayerConnection(playerId: string, token: string, connected: boolean) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();

    const { data: tokenRow, error: fetchError } = await adminSupabase
      .from('player_tokens')
      .select('client_token')
      .eq('player_id', playerId)
      .maybeSingle();

    if (fetchError || !tokenRow || tokenRow.client_token !== token) {
      throw new Error('Unauthorized or player not found.');
    }

    const { error: updateError } = await adminSupabase
      .from('players')
      .update({ connected })
      .eq('id', playerId);

    if (updateError) throw updateError;
    return { success: true };
  } catch (err) {
    console.error('updatePlayerConnection error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update connection.' };
  }
}

/** Host-controlled live 2x multiplier (persisted; submit-answer reads this). */
export async function setSessionMultiplier(sessionId: string, multiplier: 1 | 2) {
  try {
    const { supabase, user } = await getHostAuth();

    if (multiplier !== 1 && multiplier !== 2) {
      throw new Error('Invalid multiplier.');
    }

    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .update({ active_multiplier: multiplier })
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .select('id, active_multiplier, status')
      .single();

    if (sessionError || !session) {
      throw new Error('Unauthorized or session not found.');
    }

    return { success: true, active_multiplier: session.active_multiplier as 1 | 2 };
  } catch (err) {
    console.error('setSessionMultiplier error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to update multiplier.');
  }
}

export async function revealQuestionResults(sessionId: string, questionId: string) {
  try {
    const { supabase } = await getHostAuth();

    const { data, error } = await supabase.rpc('apply_question_scores_and_reveal', {
      p_session_id: sessionId,
      p_question_id: questionId,
    });

    if (error) throw error;

    const result = data as {
      optionCounts: Record<string, number>;
      leaderboard: Array<{
        id: string;
        nickname: string;
        score: number;
        streak: number;
        connected: boolean;
      }>;
      alreadyApplied?: boolean;
    };

    return {
      optionCounts: result.optionCounts || {},
      leaderboard: result.leaderboard || [],
      alreadyApplied: Boolean(result.alreadyApplied),
    };
  } catch (err) {
    console.error('revealQuestionResults error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to reveal round answers.');
  }
}

export async function goToLeaderboard(sessionId: string) {
  try {
    const { supabase, user } = await getHostAuth();
    const { error } = await supabase
      .from('game_sessions')
      .update({ status: 'leaderboard' })
      .eq('id', sessionId)
      .eq('host_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('goToLeaderboard error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to open leaderboard.');
  }
}

/** Start first question from lobby (host-authenticated). */
export async function startGameSession(sessionId: string, questionOrder: string[]) {
  try {
    const { supabase, user } = await getHostAuth();
    const serverStartedAt = new Date().toISOString();

    if (!Array.isArray(questionOrder) || questionOrder.length === 0) {
      throw new Error('Question order is required to start the game.');
    }

    const { data, error } = await supabase
      .from('game_sessions')
      .update({
        status: 'question_active',
        current_question_index: 0,
        question_started_at: serverStartedAt,
        active_multiplier: 1,
        scores_applied_question_id: null,
        question_order: questionOrder,
      })
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .eq('status', 'lobby')
      .select('id, status, question_started_at')
      .single();

    if (error || !data) {
      throw new Error('Unable to start game. Ensure the session is in lobby and you are the host.');
    }

    return { success: true, serverStartedAt: data.question_started_at as string };
  } catch (err) {
    console.error('startGameSession error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to start game.');
  }
}

export async function pauseGameSession(sessionId: string) {
  try {
    const { supabase, user } = await getHostAuth();

    const { data: session, error: fetchError } = await supabase
      .from('game_sessions')
      .select('id, status, question_started_at')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (fetchError || !session) throw new Error('Unauthorized or session not found.');
    if (session.status !== 'question_active' || !session.question_started_at) {
      throw new Error('Game is not in an active question state.');
    }

    const startedAt = new Date(session.question_started_at).getTime();
    const elapsed = Date.now() - startedAt;
    const pausedStartedAt = new Date(elapsed).toISOString();

    const { error } = await supabase
      .from('game_sessions')
      .update({
        status: 'question_paused',
        question_started_at: pausedStartedAt,
      })
      .eq('id', sessionId)
      .eq('host_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('pauseGameSession error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to pause game.');
  }
}

export async function resumeGameSession(sessionId: string) {
  try {
    const { supabase, user } = await getHostAuth();

    const { data: session, error: fetchError } = await supabase
      .from('game_sessions')
      .select('id, status, question_started_at')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (fetchError || !session) throw new Error('Unauthorized or session not found.');
    if (session.status !== 'question_paused' || !session.question_started_at) {
      throw new Error('Game is not paused.');
    }

    const elapsed = new Date(session.question_started_at).getTime();
    const newStartedAt = new Date(Date.now() - elapsed).toISOString();

    const { error } = await supabase
      .from('game_sessions')
      .update({
        status: 'question_active',
        question_started_at: newStartedAt,
      })
      .eq('id', sessionId)
      .eq('host_id', user.id);

    if (error) throw error;
    return { success: true, serverStartedAt: newStartedAt };
  } catch (err) {
    console.error('resumeGameSession error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to resume game.');
  }
}

/** Add seconds to the current question clock (default +10s). */
export async function addQuestionTime(sessionId: string, extraSeconds = 10) {
  try {
    const { supabase, user } = await getHostAuth();
    const ms = Math.max(1, extraSeconds) * 1000;

    const { data: session, error: fetchError } = await supabase
      .from('game_sessions')
      .select('id, status, question_started_at')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (fetchError || !session) throw new Error('Unauthorized or session not found.');
    if (!session.question_started_at) throw new Error('No active question clock.');
    if (!['question_active', 'question_paused'].includes(session.status)) {
      throw new Error('Cannot add time in the current state.');
    }

    let newStartedAt: string;
    if (session.status === 'question_paused') {
      const elapsed = new Date(session.question_started_at).getTime();
      const newElapsed = Math.max(0, elapsed - ms);
      newStartedAt = new Date(newElapsed).toISOString();
    } else {
      const startedAt = new Date(session.question_started_at).getTime();
      newStartedAt = new Date(startedAt + ms).toISOString();
    }

    const { error } = await supabase
      .from('game_sessions')
      .update({ question_started_at: newStartedAt })
      .eq('id', sessionId)
      .eq('host_id', user.id);

    if (error) throw error;
    return { success: true, serverStartedAt: newStartedAt, addedSeconds: extraSeconds };
  } catch (err) {
    console.error('addQuestionTime error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to add time.');
  }
}

export async function goToNextQuestion(sessionId: string, nextIndex: number) {
  try {
    const { supabase, user } = await getHostAuth();
    const serverStartedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('game_sessions')
      .update({
        status: 'question_active',
        current_question_index: nextIndex,
        question_started_at: serverStartedAt,
        active_multiplier: 1,
        scores_applied_question_id: null,
      })
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .select('question_started_at')
      .single();

    if (error || !data) throw error || new Error('Failed to open next question.');
    return { success: true, serverStartedAt: data.question_started_at as string };
  } catch (err) {
    console.error('goToNextQuestion error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to open next question.');
  }
}

export async function goToPodium(sessionId: string) {
  try {
    const { supabase, user } = await getHostAuth();
    const { error } = await supabase
      .from('game_sessions')
      .update({ status: 'finished' })
      .eq('id', sessionId)
      .eq('host_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('goToPodium error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to display podium.');
  }
}

export async function setLateJoinThroughIndex(sessionId: string, throughIndex: number) {
  try {
    const { supabase, user } = await getHostAuth();
    if (!Number.isFinite(throughIndex)) {
      throw new Error('Invalid late-join cutoff.');
    }
    const value = Math.trunc(throughIndex);
    if (value < -1 || value > 500) {
      throw new Error('Invalid late-join cutoff.');
    }

    const { data, error } = await supabase
      .from('game_sessions')
      .update({ late_join_through_index: value })
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .select('late_join_through_index')
      .single();

    if (error || !data) throw error || new Error('Unauthorized or session not found.');
    return { success: true, late_join_through_index: data.late_join_through_index as number };
  } catch (err) {
    console.error('setLateJoinThroughIndex error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to update late join.');
  }
}
