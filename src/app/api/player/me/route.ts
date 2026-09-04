import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitPlayerHydrate, tooManyRequests } from '@/lib/api/playerLimit';

export const dynamic = 'force-dynamic';

/** Authenticate a returning player by sessionId + client token. */
export async function POST(request: Request) {
  try {
    const limited = await limitPlayerHydrate(request, 'me');
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const { sessionId, token, nickname } = await request.json();

    if (!sessionId || !token) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: tokenRow, error: tokenError } = await admin
      .from('player_tokens')
      .select('player_id, client_token')
      .eq('client_token', token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    const [{ data: player, error: playerError }, { data: session }] = await Promise.all([
      admin
        .from('players')
        .select('id, session_id, nickname, team_name, score, streak, connected, joined_at')
        .eq('id', tokenRow.player_id)
        .eq('session_id', sessionId)
        .maybeSingle(),
      admin.from('game_sessions').select('status').eq('id', sessionId).single(),
    ]);

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found in this session.' }, { status: 404 });
    }

    if (nickname && player.nickname !== nickname.trim()) {
      return NextResponse.json({ error: 'Nickname does not match this device session.' }, { status: 403 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Game session is not available.' }, { status: 403 });
    }

    if (session.status !== 'finished') {
      void admin.from('players').update({ connected: true }).eq('id', player.id);
    }

    return NextResponse.json({
      success: true,
      player: { ...player, connected: session.status === 'finished' ? player.connected : true },
      sessionStatus: session.status,
    });
  } catch (err) {
    console.error('Player me error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
