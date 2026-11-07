import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitPlayerHydrate, tooManyIfPlayerHydrateLimited, tooManyRequests } from '@/lib/api/playerLimit';

export const dynamic = 'force-dynamic';

/** Player leaves the room. The host screen closes an empty lobby. */
export async function POST(request: Request) {
  try {
    const limited = await limitPlayerHydrate(request, 'leave');
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const { sessionId, playerId, token } = await request.json();

    if (!sessionId || !playerId || !token) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();

    const [{ data: tokenRow }, { data: player }, { data: session }] = await Promise.all([
      admin.from('player_tokens').select('client_token, player_id').eq('player_id', playerId).maybeSingle(),
      admin.from('players').select('id, session_id').eq('id', playerId).eq('session_id', sessionId).maybeSingle(),
      admin.from('game_sessions').select('id, status').eq('id', sessionId).maybeSingle(),
    ]);

    if (!tokenRow || tokenRow.client_token !== token || tokenRow.player_id !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perPlayer = await tooManyIfPlayerHydrateLimited(playerId, 'leave');
    if (perPlayer) return perPlayer;

    if (!player) {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    const { error: deleteError } = await admin.from('players').delete().eq('id', playerId).eq('session_id', sessionId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, roomClosed: false });
  } catch (err) {
    console.error('Player leave error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
