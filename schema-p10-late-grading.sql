-- P10: Late answers stay factually correct, score 0, and do not extend a streak.
-- Host reveal waits longer than the server cutoff so in-flight submits land.
-- question_started_at is stamped with Postgres now() so the grader and the
-- phones share one clock. Run after schema-p9-live.sql.

alter table public.answers_submitted
  add column if not exists was_late boolean not null default false;

create or replace function public.submit_live_answer(
  p_player_id uuid,
  p_token text,
  p_session_id uuid,
  p_question_id uuid,
  p_selected jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_player players%rowtype;
  v_session game_sessions%rowtype;
  v_question questions%rowtype;
  v_quiz quizzes%rowtype;
  v_time_taken_ms int;
  v_time_limit_ms int;
  v_is_late boolean;
  v_is_correct boolean := false;
  v_points int := 0;
  v_multiplier int := 1;
  v_new_streak int;
  v_correct jsonb;
  v_selected_sorted text[];
  v_correct_sorted text[];
  v_submitted_text text;
  v_alt text;
  v_double jsonb;
  v_expected_qid uuid;
  v_was_late boolean;
begin
  if p_selected is null or jsonb_typeof(p_selected) <> 'array' or jsonb_array_length(p_selected) = 0 then
    raise exception 'INVALID_ANSWER';
  end if;
  if jsonb_array_length(p_selected) > 6 then
    raise exception 'INVALID_ANSWER';
  end if;

  select client_token into v_token
  from public.player_tokens
  where player_id = p_player_id;

  if v_token is null or v_token is distinct from p_token then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into v_player
  from public.players
  where id = p_player_id and session_id = p_session_id;

  if not found then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into v_session
  from public.game_sessions
  where id = p_session_id;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status is distinct from 'question_active' then
    raise exception 'SUBMISSIONS_CLOSED';
  end if;

  if v_session.question_started_at is null then
    raise exception 'CLOCK_NOT_STARTED';
  end if;

  if v_session.question_order is not null and jsonb_typeof(v_session.question_order) = 'array' then
    v_expected_qid := (v_session.question_order ->> v_session.current_question_index)::uuid;
    if v_expected_qid is distinct from p_question_id then
      raise exception 'WRONG_QUESTION';
    end if;
  end if;

  select * into v_question
  from public.questions
  where id = p_question_id and quiz_id = v_session.quiz_id;

  if not found then
    raise exception 'QUESTION_NOT_FOUND';
  end if;

  if v_session.question_order is null
     and v_question.order_index is distinct from v_session.current_question_index then
    raise exception 'WRONG_QUESTION';
  end if;

  select * into v_quiz from public.quizzes where id = v_session.quiz_id;

  v_time_taken_ms := greatest(
    0,
    (extract(epoch from (now() - v_session.question_started_at)) * 1000)::int
  );
  v_time_limit_ms := v_question.time_limit_seconds * 1000;
  v_is_late := v_time_taken_ms > (v_time_limit_ms + 1500);

  -- multiplier
  v_multiplier := case when coalesce(v_session.active_multiplier, 1) = 2 then 2 else 1 end;
  if v_multiplier = 1 and v_quiz.double_points_rounds is not null then
    v_double := v_quiz.double_points_rounds;
    if v_double @> to_jsonb(p_question_id::text)
       or v_double @> to_jsonb(v_session.current_question_index::text) then
      v_multiplier := 2;
    end if;
  end if;

  -- grade: lateness never overwrites the factual result
  if v_question.type = 'poll' then
    v_is_correct := false;
  elsif v_question.type in ('mcq', 'true_false') then
    select elem into v_correct
    from jsonb_array_elements(v_question.answers) elem
    where coalesce((elem->>'is_correct')::boolean, false) = true
    limit 1;
    v_is_correct := (p_selected->>0) is not distinct from (v_correct->>'id');
  elsif v_question.type = 'multi_select' then
    select array_agg(x order by x) into v_correct_sorted
    from (
      select elem->>'id' as x
      from jsonb_array_elements(v_question.answers) elem
      where coalesce((elem->>'is_correct')::boolean, false) = true
    ) s;
    select array_agg(x order by x) into v_selected_sorted
    from (
      select jsonb_array_elements_text(p_selected) as x
    ) s;
    v_is_correct := v_correct_sorted is not distinct from v_selected_sorted;
  elsif v_question.type = 'type_answer' then
    select elem into v_correct
    from jsonb_array_elements(v_question.answers) elem
    where coalesce((elem->>'is_correct')::boolean, false) = true
    limit 1;
    v_submitted_text := lower(trim(p_selected->>0));
    foreach v_alt in array string_to_array(coalesce(v_correct->>'text', ''), ';')
    loop
      if v_submitted_text = lower(trim(v_alt)) then
        v_is_correct := true;
        exit;
      end if;
    end loop;
  end if;

  -- points: late answers still score 0
  if v_is_correct and not v_is_late then
    v_new_streak := v_player.streak + 1;
    if v_question.scoring_type = 'linear' then
      v_points := round(
        v_question.points_base * (1 - 0.5 * least(1, greatest(0, v_time_taken_ms::numeric / nullif(v_time_limit_ms, 0))))
      )::int;
    elsif v_question.scoring_type = 'flat' then
      v_points := v_question.points_base;
    else
      v_points := 0;
    end if;
    v_points := v_points + least(250, (v_new_streak - 1) * 50);
    v_points := round(v_points * v_multiplier)::int;
  else
    v_new_streak := 0;
    v_points := 0;
  end if;

  begin
    insert into public.answers_submitted (
      session_id, question_id, player_id, selected_answer_ids,
      time_taken_ms, points_awarded, is_correct, was_late
    ) values (
      p_session_id, p_question_id, p_player_id, p_selected,
      v_time_taken_ms, v_points, v_is_correct, v_is_late
    );
  exception when unique_violation then
    select points_awarded, is_correct, was_late
      into v_points, v_is_correct, v_was_late
    from public.answers_submitted
    where session_id = p_session_id
      and question_id = p_question_id
      and player_id = p_player_id;
    return jsonb_build_object(
      'success', true,
      'duplicate', true,
      'pointsAwarded', coalesce(v_points, 0),
      'isCorrect', coalesce(v_is_correct, false),
      'wasLate', coalesce(v_was_late, false)
    );
  end;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'pointsAwarded', v_points,
    'isCorrect', v_is_correct,
    'wasLate', v_is_late
  );
end;
$$;

revoke all on function public.submit_live_answer(uuid, text, uuid, uuid, jsonb) from public;
grant execute on function public.submit_live_answer(uuid, text, uuid, uuid, jsonb) to service_role;

create or replace function public.apply_question_scores_and_reveal(
  p_session_id uuid,
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_option_counts jsonb := '{}'::jsonb;
  v_leaderboard jsonb := '[]'::jsonb;
  v_already boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_session
  from public.game_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.host_id <> auth.uid() then
    raise exception 'Unauthorized';
  end if;

  v_already :=
    v_session.scores_applied_question_id is not distinct from p_question_id
    or p_question_id = any(coalesce(v_session.scored_question_ids, '{}'::uuid[]));

  if v_already then
    select coalesce(
      (
        select jsonb_object_agg(option_id, cnt)
        from (
          select opt as option_id, count(*)::int as cnt
          from public.answers_submitted a,
               lateral jsonb_array_elements_text(a.selected_answer_ids) opt
          where a.session_id = p_session_id and a.question_id = p_question_id
          group by opt
        ) t
      ),
      '{}'::jsonb
    ) into v_option_counts;

    select coalesce(jsonb_agg(to_jsonb(lb)), '[]'::jsonb)
    into v_leaderboard
    from (
      select id, nickname, score, streak, connected
      from public.players
      where session_id = p_session_id
      order by score desc
      limit 5
    ) lb;

    if v_session.status <> 'question_reveal' then
      update public.game_sessions
      set status = 'question_reveal', active_multiplier = 1
      where id = p_session_id;
    end if;

    return jsonb_build_object(
      'optionCounts', v_option_counts,
      'leaderboard', v_leaderboard,
      'alreadyApplied', true
    );
  end if;

  if v_session.status not in ('question_active', 'question_paused') then
    raise exception 'Invalid session status for reveal: %', v_session.status;
  end if;

  update public.players as p
  set
    score = p.score + coalesce(s.points_awarded, 0),
    streak = case
      when s.is_correct is true and coalesce(s.points_awarded, 0) > 0 then p.streak + 1
      else 0
    end
  from (
    select pl.id as player_id, a.points_awarded, a.is_correct
    from public.players pl
    left join public.answers_submitted a
      on a.player_id = pl.id
     and a.session_id = p_session_id
     and a.question_id = p_question_id
    where pl.session_id = p_session_id
  ) as s
  where p.id = s.player_id;

  update public.game_sessions
  set
    status = 'question_reveal',
    scores_applied_question_id = p_question_id,
    scored_question_ids = array_append(coalesce(scored_question_ids, '{}'::uuid[]), p_question_id),
    active_multiplier = 1
  where id = p_session_id;

  select coalesce(
    (
      select jsonb_object_agg(option_id, cnt)
      from (
        select opt as option_id, count(*)::int as cnt
        from public.answers_submitted a,
             lateral jsonb_array_elements_text(a.selected_answer_ids) opt
        where a.session_id = p_session_id and a.question_id = p_question_id
        group by opt
      ) t
    ),
    '{}'::jsonb
  ) into v_option_counts;

  select coalesce(jsonb_agg(to_jsonb(lb)), '[]'::jsonb)
  into v_leaderboard
  from (
    select id, nickname, score, streak, connected
    from public.players
    where session_id = p_session_id
    order by score desc
    limit 5
  ) lb;

  return jsonb_build_object(
    'optionCounts', v_option_counts,
    'leaderboard', v_leaderboard,
    'alreadyApplied', false
  );
end;
$$;

revoke all on function public.apply_question_scores_and_reveal(uuid, uuid) from public;
grant execute on function public.apply_question_scores_and_reveal(uuid, uuid) to authenticated;

-- Stamp the live clock from Postgres now() so the grader and the phones agree.
create or replace function public.start_question_clock(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  update public.game_sessions
  set question_started_at = now()
  where id = p_session_id
    and host_id = auth.uid()
  returning question_started_at into v_started;

  if v_started is null then
    raise exception 'Unauthorized or session not found';
  end if;
  return v_started;
end;
$$;

revoke all on function public.start_question_clock(uuid) from public;
grant execute on function public.start_question_clock(uuid) to authenticated;
