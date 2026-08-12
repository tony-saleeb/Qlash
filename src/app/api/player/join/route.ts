import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit({ key: `join:${ip}`, limit: 20, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many join attempts. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const { pin, nickname, teamName } = await request.json();

    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      return NextResponse.json({ error: 'Invalid PIN.' }, { status: 400 });
    }
    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
      return NextResponse.json({ error: 'Nickname is required.' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from('game_sessions')
      .select('id, status, quiz_id, quizzes(team_mode)')
      .eq('pin', pin)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Game room not found.' }, { status: 404 });
    }

    if (session.status === 'finished') {
      return NextResponse.json({ error: 'This game has already finished.' }, { status: 403 });
    }

    const sessionWithQuiz = session as unknown as {
      id: string;
      status: string;
      quizzes: { team_mode: boolean } | null;
    };
    const isTeamQuiz = Boolean(sessionWithQuiz.quizzes?.team_mode);

    if (isTeamQuiz && (!teamName || !String(teamName).trim())) {
      return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
    }

    const trimmedNickname = nickname.trim();

    const { data: existingPlayer } = await admin
      .from('players')
      .select('id')
      .eq('session_id', session.id)
      .eq('nickname', trimmedNickname)
      .maybeSingle();

    // Reconnect: client must prove possession of token via /api/player/me
    // Duplicate nicknames from other devices are rejected here.
    if (existingPlayer) {
      return NextResponse.json(
        {
          error: 'Nickname already taken in this room.',
          code: 'NICKNAME_TAKEN',
          sessionId: session.id,
          playerId: existingPlayer.id,
        },
        { status: 409 }
      );
    }

    const clientToken = randomUUID();

    const { data: player, error: joinError } = await admin
      .from('players')
      .insert({
        session_id: session.id,
        nickname: trimmedNickname,
        team_name: isTeamQuiz ? String(teamName).trim() : null,
        connected: true,
      })
      .select('id, session_id, nickname, team_name, score, streak, connected')
      .single();

    if (joinError || !player) {
      throw joinError || new Error('Failed to join.');
    }

    const { error: tokenError } = await admin.from('player_tokens').insert({
      player_id: player.id,
      client_token: clientToken,
    });

    if (tokenError) {
      await admin.from('players').delete().eq('id', player.id);
      throw tokenError;
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      player,
      token: clientToken,
    });
  } catch (err) {
    console.error('Player join error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
