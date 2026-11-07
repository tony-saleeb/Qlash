import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import {
  NICKNAME_MAX_LEN,
  NICKNAME_MIN_LEN,
  RATE_LIMITS,
  livePlayerCap,
  roomIsFull,
} from '@/lib/game/constants';
import { canInsertNewPlayer, priorJoinTokens, roomOpenedTooLongAgo } from '@/lib/game/lateJoin';
import { TEAM_NAME_MAX_LEN, cleanPlayerName } from '@/lib/game/playerName';
import { readJsonObject } from '@/lib/api/readJsonBody';

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

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
    }
    const { pin, nickname, teamName, priorTokens } = body;

    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      return NextResponse.json({ error: 'Invalid PIN.' }, { status: 400 });
    }
    const trimmedNickname = cleanPlayerName(nickname, NICKNAME_MAX_LEN);
    if (!trimmedNickname || trimmedNickname.length < NICKNAME_MIN_LEN) {
      return NextResponse.json({ error: 'Nickname is required.' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from('game_sessions')
      .select(
        'id, status, created_at, quiz_id, current_question_index, late_join_through_index, join_locked, quizzes(team_mode), hosts(plan)'
      )
      .eq('pin', pin)
      .neq('status', 'finished')
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Game room not found.' }, { status: 404 });
    }

    if (roomOpenedTooLongAgo((session as { created_at?: string | null }).created_at)) {
      return NextResponse.json(
        { error: 'This room has expired.', code: 'ROOM_EXPIRED' },
        { status: 403 }
      );
    }

    const sessionWithQuiz = session as unknown as {
      id: string;
      status: string;
      created_at?: string | null;
      late_join_through_index?: number | null;
      join_locked?: boolean | null;
      quizzes: { team_mode: boolean } | { team_mode: boolean }[] | null;
      hosts: { plan: string } | { plan: string }[] | null;
    };

    const sessionLimited = await rateLimit({
      key: `join:session:${session.id}`,
      limit: RATE_LIMITS.joinPerSession.limit,
      windowMs: RATE_LIMITS.joinPerSession.windowMs,
    });
    if (!sessionLimited.ok) {
      return NextResponse.json(
        { error: 'Too many people are joining this room. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(sessionLimited.retryAfterSec) } }
      );
    }

    if (sessionWithQuiz.join_locked) {
      return NextResponse.json(
        { error: 'The host has locked this room.', code: 'JOIN_LOCKED' },
        { status: 403 }
      );
    }

    if (!canInsertNewPlayer(sessionWithQuiz)) {
      const finished = sessionWithQuiz.status === 'finished';
      return NextResponse.json(
        {
          error: finished ? 'This game has already finished.' : 'This game has already started.',
          code: finished ? undefined : 'GAME_STARTED',
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

    const trimmedTeam = cleanPlayerName(teamName, TEAM_NAME_MAX_LEN);
    if (isTeamQuiz && !trimmedTeam) {
      return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
    }

    const deviceTokens = priorJoinTokens(priorTokens);
    const [{ data: kickedName }, tokenKick] = await Promise.all([
      admin
        .from('session_kicks')
        .select('nickname')
        .eq('session_id', session.id)
        .eq('nickname', trimmedNickname)
        .maybeSingle(),
      deviceTokens.length
        ? admin
            .from('session_kicks')
            .select('client_token')
            .eq('session_id', session.id)
            .in('client_token', deviceTokens)
            .limit(1)
        : Promise.resolve({ data: [] as { client_token: string }[] }),
    ]);
    const kickedToken = Array.isArray(tokenKick.data) ? tokenKick.data.length > 0 : Boolean(tokenKick.data);
    if (kickedName || kickedToken) {
      return NextResponse.json(
        { error: 'You were removed from this room.', code: 'KICKED' },
        { status: 403 }
      );
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

    if (roomIsFull(count || 0, playerCap)) {
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
        team_name: isTeamQuiz ? trimmedTeam : null,
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
