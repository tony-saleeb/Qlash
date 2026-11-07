-- P16: Removing a question or a quiz must not erase past answers.
-- Questions are archived. Quizzes are hidden. Rows stay so reports and
-- in-progress rooms can still read them. answers_submitted.question_id
-- stays ON DELETE CASCADE as a backstop; the app no longer issues that delete.

alter table public.quizzes
  add column if not exists deleted_at timestamptz;

alter table public.questions
  add column if not exists archived_at timestamptz;

create index if not exists quizzes_host_active_idx
  on public.quizzes (host_id)
  where deleted_at is null;

create index if not exists questions_quiz_active_idx
  on public.questions (quiz_id, order_index)
  where archived_at is null;

create or replace function public.create_live_lobby(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid := auth.uid();
  v_session public.game_sessions%rowtype;
  v_pin text;
  v_attempt int;
begin
  if v_host is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_quiz_id is null or not exists (
    select 1
    from public.quizzes q
    where q.id = p_quiz_id
      and q.host_id = v_host
      and q.deleted_at is null
  ) then
    raise exception 'Quiz not found or unauthorized.' using errcode = 'P0001';
  end if;

  for v_attempt in 1..8 loop
    v_pin := (100000 + floor(random() * 900000))::int::text;
    begin
      insert into public.game_sessions (
        quiz_id,
        host_id,
        pin,
        status,
        current_question_index,
        active_multiplier,
        late_join_through_index
      ) values (
        p_quiz_id,
        v_host,
        v_pin,
        'lobby',
        0,
        1,
        2
      )
      returning * into v_session;

      return jsonb_build_object(
        'id', v_session.id,
        'pin', v_session.pin,
        'status', v_session.status,
        'current_question_index', v_session.current_question_index,
        'question_started_at', v_session.question_started_at,
        'quiz_id', v_session.quiz_id,
        'host_id', v_session.host_id,
        'active_multiplier', v_session.active_multiplier,
        'question_order', v_session.question_order,
        'late_join_through_index', v_session.late_join_through_index
      );
    exception
      when unique_violation then
        null;
    end;
  end loop;

  raise exception 'Failed to generate a unique PIN code. Please try again.' using errcode = 'P0001';
end;
$$;

revoke all on function public.create_live_lobby(uuid) from public;
grant execute on function public.create_live_lobby(uuid) to authenticated;
