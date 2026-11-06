import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitPlayerHydrateSharded, tooManyRequests } from '@/lib/api/playerLimit';
import { canCheerOnProjector, isLobbyReactionId } from '@/lib/game/reactions';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Best-effort lobby mark. The phone never writes to Realtime. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sessionId, playerId, token, mark } = body as {
      sessionId?: unknown;
      playerId?: unknown;
      token?: unknown;
      mark?: unknown;
    };

    if (
      typeof sessionId !== 'string' ||
      typeof playerId !== 'string' ||
      typeof token !== 'string' ||
      !sessionId ||
      !playerId ||
      !token ||
      !isLobbyReactionId(mark)
    ) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const limited = await limitPlayerHydrateSharded(request, 'react', playerId);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

    const admin = createAdminClient();
    const [{ data: tokenRow }, { data: player }, { data: session }] = await Promise.all([
      admin.from('player_tokens').select('client_token').eq('player_id', playerId).maybeSingle(),
      admin
        .from('players')
        .select('id, nickname')
        .eq('id', playerId)
        .eq('session_id', sessionId)
        .maybeSingle(),
      admin.from('game_sessions').select('status').eq('id', sessionId).maybeSingle(),
    ]);

    if (!tokenRow || tokenRow.client_token !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!player) {
      return NextResponse.json({ error: 'Player not found in this session.' }, { status: 404 });
    }

    if (!session || !canCheerOnProjector(session.status)) {
      return new NextResponse(null, { status: 204 });
    }

    const [playerLimited, roomLimited] = await Promise.all([
      rateLimit({ key: `react:player:${playerId}`, limit: 1, windowMs: 1500 }),
      rateLimit({ key: `react:room:${sessionId}`, limit: 10, windowMs: 1000 }),
    ]);
    if (!playerLimited.ok || !roomLimited.ok) {
      return new NextResponse(null, { status: 204 });
    }

    const { error } = await admin.rpc('send_lobby_reaction', {
      p_session_id: sessionId,
      p_mark: mark,
      p_nickname: player.nickname,
    });
    if (error) {
      console.error('send_lobby_reaction error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('react error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
