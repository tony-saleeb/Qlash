-- P13: one UPDATE per live transition, every clock stamped by Postgres now().
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

  select gs.quiz_id into v_quiz
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

  update public.game_sessions
  set status = 'question_active',
      current_question_index = 0,
      active_multiplier = 1,
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
begin
  if (select auth.uid()) is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  select gs.question_order, gs.quiz_id into v_order, v_quiz
  from public.game_sessions gs
  where gs.id = p_session_id and gs.host_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Unauthorized or session not found';
  end if;
  if v_order is not null and jsonb_typeof(v_order) = 'array' then
    v_count := jsonb_array_length(v_order);
  else
    select count(*) into v_count from public.questions q where q.quiz_id = v_quiz;
  end if;
  if p_index is null or p_index < 0 or p_index >= v_count then
    raise exception 'INVALID_INDEX';
  end if;

  update public.game_sessions
  set status = 'question_active',
      current_question_index = p_index,
      active_multiplier = 1,
      scores_applied_question_id = null,
      question_started_at = now()
  where id = p_session_id
  returning question_started_at into v_started;
  return v_started;
end;
$$;

create or replace function public.pause_question(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  update public.game_sessions
  set status = 'question_paused',
      question_started_at = to_timestamp(0) + (now() - question_started_at)
  where id = p_session_id
    and host_id = (select auth.uid())
    and status = 'question_active'
    and question_started_at is not null
  returning question_started_at into v_paused;
  if v_paused is null then
    raise exception 'Game is not in an active question state.';
  end if;
  return v_paused;
end;
$$;

create or replace function public.resume_question(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  update public.game_sessions
  set status = 'question_active',
      question_started_at = now() - (question_started_at - to_timestamp(0))
  where id = p_session_id
    and host_id = (select auth.uid())
    and status = 'question_paused'
    and question_started_at is not null
  returning question_started_at into v_started;
  if v_started is null then
    raise exception 'Game is not paused.';
  end if;
  return v_started;
end;
$$;

create or replace function public.add_question_time(p_session_id uuid, p_seconds int)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 300 then
    raise exception 'INVALID_SECONDS';
  end if;
  update public.game_sessions
  set question_started_at = case
        when status = 'question_paused'
          then greatest(to_timestamp(0), question_started_at - make_interval(secs => p_seconds))
        else question_started_at + make_interval(secs => p_seconds)
      end
  where id = p_session_id
    and host_id = (select auth.uid())
    and status in ('question_active', 'question_paused')
    and question_started_at is not null
  returning question_started_at into v_started;
  if v_started is null then
    raise exception 'Cannot add time in the current state.';
  end if;
  return v_started;
end;
$$;

revoke all on function public.start_game(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.advance_question(uuid, int) from public, anon, authenticated;
revoke all on function public.pause_question(uuid) from public, anon, authenticated;
revoke all on function public.resume_question(uuid) from public, anon, authenticated;
revoke all on function public.add_question_time(uuid, int) from public, anon, authenticated;
grant execute on function public.start_game(uuid, jsonb) to authenticated;
grant execute on function public.advance_question(uuid, int) to authenticated;
grant execute on function public.pause_question(uuid) to authenticated;
grant execute on function public.resume_question(uuid) to authenticated;
grant execute on function public.add_question_time(uuid, int) to authenticated;
