import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Return the calling player's own submission for a question (token-gated). */
export async function POST(request: Request) {
  try {
    const { sessionId, playerId, token, questionId } = await request.json();

    if (!sessionId || !playerId || !token || !questionId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: tokenRow } = await admin
      .from('player_tokens')
      .select('client_token')
      .eq('player_id', playerId)
      .maybeSingle();

    if (!tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: session } = await admin
      .from('game_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    // Only expose correctness/points after reveal (or later phases)
    const allowed = ['question_reveal', 'leaderboard', 'finished'].includes(session?.status || '');
    if (!allowed) {
      return NextResponse.json({ error: 'Results not available yet.' }, { status: 403 });
    }

    const { data: submission } = await admin
      .from('answers_submitted')
      .select('points_awarded, is_correct')
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
      .eq('player_id', playerId)
      .maybeSingle();

    const { data: player } = await admin
      .from('players')
      .select('score, streak')
      .eq('id', playerId)
      .single();

    return NextResponse.json({
      success: true,
      submission: submission || { points_awarded: 0, is_correct: false },
      player: player || { score: 0, streak: 0 },
    });
  } catch (err) {
    console.error('Round result error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
