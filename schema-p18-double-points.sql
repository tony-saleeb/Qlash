-- P18: double points follow the question, not the shuffled play slot.
-- Stored rounds become question ids. Starting a question stamps active_multiplier
-- from that id (or from a 2x the host armed on the lobby or leaderboard).
-- A leftover editor position matches the question's library order_index.

update public.quizzes q
set double_points_rounds = coalesce((
  select jsonb_agg(to_jsonb(picked.id) order by picked.ord)
  from (
    select distinct on (qs.id) qs.id::text as id, elem.ord
    from jsonb_array_elements_text(q.double_points_rounds) with ordinality as elem(val, ord)
    join public.questions qs
      on qs.quiz_id = q.id
     and qs.archived_at is null
     and (
       qs.id::text = elem.val
       or (elem.val ~ '^[0-9]+$' and qs.order_index = elem.val::int)
     )
    order by qs.id, elem.ord
  ) picked
), '[]'::jsonb)
where jsonb_typeof(q.double_points_rounds) = 'array'
  and exists (
    select 1
    from jsonb_array_elements_text(q.double_points_rounds) elem(val)
    where elem.val ~ '^[0-9]+$'
  );

create or replace function public.start_game(p_session_id uuid, p_question_order jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz uuid;
  v_len int;
  v_started timestamptz;
  v_armed int;
  v_multiplier int;
  v_double jsonb;
  v_first text;
begin
  if (select auth.uid()) is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_question_order is null or jsonb_typeof(p_question_order) <> 'array' then
    raise exception 'INVALID_ORDER';
  end if;
  v_len := jsonb_array_length(p_question_order);
  if v_len = 0 or v_len > 200 then
    raise exception 'INVALID_ORDER';
  end if;

  select gs.quiz_id, gs.active_multiplier into v_quiz, v_armed
  from public.game_sessions gs
  where gs.id = p_session_id and gs.host_id = (select auth.uid()) and gs.status = 'lobby'
  for update;
  if not found then
    raise exception 'Unable to start game. Ensure the session is in lobby and you are the host.';
  end if;

  if (select count(distinct x) from jsonb_array_elements_text(p_question_order) x) <> v_len
     or exists (
       select 1 from jsonb_array_elements_text(p_question_order) x
       where not exists (
         select 1 from public.questions q where q.id::text = x and q.quiz_id = v_quiz
       )
     ) then
    raise exception 'INVALID_ORDER';
  end if;

  v_first := p_question_order ->> 0;
  v_multiplier := 1;
  select qz.double_points_rounds into v_double
  from public.quizzes qz
  where qz.id = v_quiz;
  if v_double is not null and (
       v_double @> to_jsonb(v_first)
       or exists (
         select 1 from public.questions q
         where q.id::text = v_first
           and q.quiz_id = v_quiz
           and v_double @> to_jsonb(q.order_index::text)
       )
     ) then
    v_multiplier := 2;
  elsif coalesce(v_armed, 1) = 2 then
    v_multiplier := 2;
  end if;

  update public.game_sessions
  set status = 'question_active',
      current_question_index = 0,
      active_multiplier = v_multiplier,
      scores_applied_question_id = null,
      question_order = p_question_order,
      question_started_at = now()
  where id = p_session_id
  returning question_started_at into v_started;
  return v_started;
end;
$$;

create or replace function public.advance_question(p_session_id uuid, p_index int)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order jsonb;
  v_quiz uuid;
  v_count int;
  v_started timestamptz;
  v_status text;
  v_armed int;
  v_qid text;
  v_multiplier int;
  v_double jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  select gs.question_order, gs.quiz_id, gs.status, gs.active_multiplier
    into v_order, v_quiz, v_status, v_armed
  from public.game_sessions gs
  where gs.id = p_session_id and gs.host_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Unauthorized or session not found';
  end if;
  if v_order is not null and jsonb_typeof(v_order) = 'array' then
    v_count := jsonb_array_length(v_order);
    v_qid := v_order ->> p_index;
  else
    select count(*) into v_count from public.questions q where q.quiz_id = v_quiz;
    select q.id::text into v_qid
    from public.questions q
    where q.quiz_id = v_quiz
      and q.order_index = p_index
      and q.archived_at is null
    limit 1;
  end if;
  if p_index is null or p_index < 0 or p_index >= v_count then
    raise exception 'INVALID_INDEX';
  end if;

  v_multiplier := 1;
  select qz.double_points_rounds into v_double
  from public.quizzes qz
  where qz.id = v_quiz;
  if v_qid is not null and v_double is not null and (
       v_double @> to_jsonb(v_qid)
       or exists (
         select 1 from public.questions q
         where q.id::text = v_qid
           and v_double @> to_jsonb(q.order_index::text)
       )
     ) then
    v_multiplier := 2;
  elsif v_status in ('lobby', 'leaderboard') and coalesce(v_armed, 1) = 2 then
    v_multiplier := 2;
  end if;

  update public.game_sessions
  set status = 'question_active',
      current_question_index = p_index,
      active_multiplier = v_multiplier,
      scores_applied_question_id = null,
      question_started_at = now()
  where id = p_session_id
  returning question_started_at into v_started;
  return v_started;
end;
$$;

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

  -- multiplier: a numeric token is the library position, not the play slot
  v_multiplier := case when coalesce(v_session.active_multiplier, 1) = 2 then 2 else 1 end;
  if v_multiplier = 1 and v_quiz.double_points_rounds is not null then
    v_double := v_quiz.double_points_rounds;
    if v_double @> to_jsonb(p_question_id::text)
       or v_double @> to_jsonb(v_question.order_index::text) then
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
