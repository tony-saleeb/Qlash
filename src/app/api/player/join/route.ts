import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import {
  NICKNAME_MAX_LEN,
  NICKNAME_MIN_LEN,
  RATE_LIMITS,
  livePlayerCap,
} from '@/lib/game/constants';
import { canInsertNewPlayer } from '@/lib/game/lateJoin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = await rateLimit({
      key: `join:${ip}`,
      limit: RATE_LIMITS.joinPerIp.limit,
      windowMs: RATE_LIMITS.joinPerIp.windowMs,
    });
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
    if (!nickname || typeof nickname !== 'string') {
      return NextResponse.json({ error: 'Nickname is required.' }, { status: 400 });
    }

    const trimmedNickname = nickname.trim().slice(0, NICKNAME_MAX_LEN);
    if (trimmedNickname.length < NICKNAME_MIN_LEN) {
      return NextResponse.json({ error: 'Nickname is required.' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from('game_sessions')
      .select(
        'id, status, quiz_id, current_question_index, late_join_through_index, quizzes(team_mode), hosts(plan)'
      )
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
      current_question_index?: number | null;
      late_join_through_index?: number | null;
      quizzes: { team_mode: boolean } | { team_mode: boolean }[] | null;
      hosts: { plan: string } | { plan: string }[] | null;
    };

    // New players: lobby, or any live round when late join is on. Reconnect is always 409 + /me.
    if (!canInsertNewPlayer(sessionWithQuiz)) {
      const { data: existingMidGame } = await admin
        .from('players')
        .select('id')
        .eq('session_id', session.id)
        .eq('nickname', trimmedNickname)
        .maybeSingle();

      if (existingMidGame) {
        return NextResponse.json(
          {
            error: 'Nickname already taken in this room.',
            code: 'NICKNAME_TAKEN',
            sessionId: session.id,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
          {
            error: 'This game has already started. Reconnect with your same nickname from this device, or wait for the next lobby.',
            code: 'GAME_STARTED',
          },
        { status: 403 }
      );
    }

    const quizMeta = Array.isArray(sessionWithQuiz.quizzes)
      ? sessionWithQuiz.quizzes[0]
      : sessionWithQuiz.quizzes;
    const hostMeta = Array.isArray(sessionWithQuiz.hosts)
      ? sessionWithQuiz.hosts[0]
      : sessionWithQuiz.hosts;
    const isTeamQuiz = Boolean(quizMeta?.team_mode);
    const playerCap = livePlayerCap(hostMeta?.plan);

    if (isTeamQuiz && (!teamName || !String(teamName).trim())) {
      return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
    }

    const [{ data: existingPlayer }, countResult] = await Promise.all([
      admin
        .from('players')
        .select('id')
        .eq('session_id', session.id)
        .eq('nickname', trimmedNickname)
        .maybeSingle(),
      admin
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id),
    ]);

    if (existingPlayer) {
      return NextResponse.json(
        {
          error: 'Nickname already taken in this room.',
          code: 'NICKNAME_TAKEN',
          sessionId: session.id,
        },
        { status: 409 }
      );
    }

    const { count, error: countError } = countResult;
    if (countError) throw countError;

    if ((count || 0) >= playerCap) {
      return NextResponse.json(
        {
          error: `This room is full (${playerCap} players max).`,
          code: 'ROOM_FULL',
        },
        { status: 403 }
      );
    }

    const clientToken = randomUUID();

    const { data: player, error: joinError } = await admin
      .from('players')
      .insert({
        session_id: session.id,
        nickname: trimmedNickname,
        team_name: isTeamQuiz ? String(teamName).trim().slice(0, 40) : null,
        connected: true,
      })
      .select('id, session_id, nickname, team_name, score, streak, connected')
      .single();

    if (joinError || !player) {
      const code = (joinError as { code?: string } | null)?.code;
      const message = (joinError as { message?: string } | null)?.message || '';
      if (code === '23505') {
        return NextResponse.json(
          {
            error: 'Nickname already taken in this room.',
            code: 'NICKNAME_TAKEN',
            sessionId: session.id,
          },
          { status: 409 }
        );
      }
      if (code === 'P0001' || /ROOM_FULL/i.test(message)) {
        return NextResponse.json(
          {
            error: `This room is full (${playerCap} players max).`,
            code: 'ROOM_FULL',
          },
          { status: 403 }
        );
      }
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
