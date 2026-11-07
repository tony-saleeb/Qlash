-- Pause +10s, a late reveal, the 80-player cap, and the rate limiter.
begin;
select plan(4);

create or replace function pg_temp.live_room_checks()
returns setof text
language plpgsql
as $$
declare
  v_host uuid;
  v_quiz uuid;
  v_session uuid;
  v_q1 uuid;
  v_q2 uuid;
  v_started timestamptz;
  v_remaining int;
  v_status text;
  v_cap_blocked boolean := false;
  v_first boolean;
  v_second boolean;
  v_answers jsonb := '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb;
  i int;
begin
  select id into v_host from public.hosts limit 1;
  if v_host is null then
    return next ok(false, 'a seed host exists');
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_host::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_host, 'role', 'authenticated')::text,
    true
  );

  insert into public.quizzes (host_id, title)
  values (v_host, 'ci live room')
  returning id into v_quiz;

  insert into public.questions (quiz_id, order_index, type, prompt, time_limit_seconds, points_base, scoring_type, answers)
  values (v_quiz, 0, 'mcq', 'one', 20, 1000, 'linear', v_answers)
  returning id into v_q1;

  insert into public.questions (quiz_id, order_index, type, prompt, time_limit_seconds, points_base, scoring_type, answers)
  values (v_quiz, 1, 'mcq', 'two', 20, 1000, 'linear', v_answers)
  returning id into v_q2;

  insert into public.game_sessions (
    quiz_id, host_id, pin, status, current_question_index, question_started_at, question_order
  ) values (
    v_quiz, v_host, '910001', 'question_paused', 0, timestamptz '1970-01-01 00:00:05+00',
    jsonb_build_array(v_q1::text)
  )
  returning id into v_session;

  v_started := public.add_question_time(v_session, 10);
  v_remaining := floor(20 - extract(epoch from v_started));
  return next is(v_remaining, 25, 'pause plus 10 seconds adds a full 10 seconds');

  insert into public.game_sessions (
    quiz_id, host_id, pin, status, current_question_index, question_started_at, question_order
  ) values (
    v_quiz, v_host, '910002', 'question_active', 0, now(),
    jsonb_build_array(v_q1::text, v_q2::text)
  )
  returning id into v_session;

  perform public.apply_question_scores_and_reveal(v_session, v_q1);
  update public.game_sessions
  set status = 'question_active', current_question_index = 1
  where id = v_session;
  perform public.apply_question_scores_and_reveal(v_session, v_q1);
  select status into v_status from public.game_sessions where id = v_session;
  return next is(v_status, 'question_active', 'a late reveal for an earlier question leaves the current question open');

  insert into public.game_sessions (quiz_id, host_id, pin, status)
  values (v_quiz, v_host, '910003', 'question_active')
  returning id into v_session;

  for i in 1..80 loop
    insert into public.players (session_id, nickname) values (v_session, 'p' || i);
  end loop;
  begin
    insert into public.players (session_id, nickname) values (v_session, 'overflow');
    v_cap_blocked := false;
  exception
    when sqlstate 'P0001' then
      v_cap_blocked := true;
  end;
  return next ok(v_cap_blocked, 'the 81st player is refused');

  v_first := (public.consume_rate_limit('ci-live-room', 1, 60000)->>'ok')::boolean;
  v_second := (public.consume_rate_limit('ci-live-room', 1, 60000)->>'ok')::boolean;
  return next ok(v_first and not v_second, 'the rate limiter allows one call and denies the next');
end;
$$;

select pg_temp.live_room_checks();
select * from finish();
rollback;
