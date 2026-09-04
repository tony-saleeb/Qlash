import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitPlayerHydrate, tooManyRequests } from '@/lib/api/playerLimit';

export const dynamic = 'force-dynamic';

/** Token-gated connected flag. keepalive-safe for tab close. */
export async function POST(request: Request) {
  try {
    const limited = await limitPlayerHydrate(request, 'connection');
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const { playerId, token, connected, sessionId } = await request.json();

    if (!playerId || !token || typeof connected !== 'boolean') {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: tokenRow } = await admin
      .from('player_tokens')
      .select('client_token, player_id')
      .eq('player_id', playerId)
      .maybeSingle();

    if (!tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = admin.from('players').update({ connected }).eq('id', playerId);
    if (typeof sessionId === 'string' && sessionId) {
      query = query.eq('session_id', sessionId);
    }
    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Player connection error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
