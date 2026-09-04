import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitPlayerHydrate, tooManyRequests } from '@/lib/api/playerLimit';

export const dynamic = 'force-dynamic';

/** Token-gated roster for rank / podium. Players never read the public table. */
export async function POST(request: Request) {
  try {
    const limited = await limitPlayerHydrate(request, 'roster');
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const { sessionId, token } = await request.json();
    if (!sessionId || !token) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: tokenRow } = await admin
      .from('player_tokens')
      .select('player_id, client_token')
      .eq('client_token', token)
      .maybeSingle();

    if (!tokenRow) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: player } = await admin
      .from('players')
      .select('id')
      .eq('id', tokenRow.player_id)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: 'Player not found in this session.' }, { status: 404 });
    }

    const { data: players, error } = await admin
      .from('players')
      .select('id, nickname, score, streak, connected')
      .eq('session_id', sessionId)
      .order('score', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, players: players || [] });
  } catch (err) {
    console.error('Player roster error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
