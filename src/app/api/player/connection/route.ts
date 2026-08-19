import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Token-gated connected flag. keepalive-safe for tab close. */
export async function POST(request: Request) {
  try {
    const { playerId, token, connected } = await request.json();

    if (!playerId || !token || typeof connected !== 'boolean') {
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

    const { error } = await admin.from('players').update({ connected }).eq('id', playerId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Player connection error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
