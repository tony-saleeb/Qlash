import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { playerId, token } = await request.json();
    if (!playerId || !token) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: tokenRow, error: fetchError } = await adminSupabase
      .from('player_tokens')
      .select('client_token')
      .eq('player_id', playerId)
      .maybeSingle();

    if (fetchError || !tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error: updateError } = await adminSupabase
      .from('players')
      .update({ connected: false })
      .eq('id', playerId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Player disconnect API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
