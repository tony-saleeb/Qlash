-- P19: a saved question has to be gradable, and typed Arabic matches letter variants.
-- Time is 5-240 seconds, points are 0-2000, media is https, and the answer key
-- matches the question type. Type-answer grading folds alef, taa marbuta, alef
-- maksura, and short vowels.

create or replace function public.normalize_answer_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    lower(btrim(coalesce(p_text, ''))),
    'أإآٱةىًٌٍَُِّْٰـ',
    'ااااهي'
  );
$$;

revoke all on function public.normalize_answer_text(text) from public, anon, authenticated;

create or replace function public.question_answers_valid(p_type text, p_answers jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(p_answers) = 'array'
    and jsonb_array_length(p_answers) between 1 and 6
    and case p_type
      when 'type_answer' then length(btrim(coalesce((
        select e->>'text'
        from jsonb_array_elements(p_answers) e
        where coalesce((e->>'is_correct')::boolean, false)
        limit 1
      ), ''))) > 0
      when 'poll' then jsonb_array_length(p_answers) between 2 and 6
      when 'multi_select' then
        jsonb_array_length(p_answers) between 2 and 6
        and (
          select count(*) from jsonb_array_elements(p_answers) e
          where coalesce((e->>'is_correct')::boolean, false)
        ) >= 1
      when 'mcq' then
        jsonb_array_length(p_answers) between 2 and 6
        and (
          select count(*) from jsonb_array_elements(p_answers) e
          where coalesce((e->>'is_correct')::boolean, false)
        ) = 1
      when 'true_false' then
        jsonb_array_length(p_answers) between 2 and 6
        and (
          select count(*) from jsonb_array_elements(p_answers) e
          where coalesce((e->>'is_correct')::boolean, false)
        ) = 1
      else false
    end;
$$;

revoke all on function public.question_answers_valid(text, jsonb) from public, anon, authenticated;

alter table public.questions alter column time_limit_seconds set not null;
alter table public.questions alter column points_base set not null;

alter table public.questions
  add constraint questions_type_check
  check (type in ('mcq', 'true_false', 'multi_select', 'type_answer', 'poll'));

alter table public.questions
  add constraint questions_time_limit_check
  check (time_limit_seconds between 5 and 240);

alter table public.questions
  add constraint questions_points_base_check
  check (points_base between 0 and 2000);

alter table public.questions
  add constraint questions_media_url_check
  check (media_url is null or btrim(media_url) = '' or media_url like 'https://%');

alter table public.questions
  add constraint questions_answers_check
  check (public.question_answers_valid(type, answers));
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

  if v_session.status = 'question_paused' then
    raise exception 'QUESTION_PAUSED';
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
    v_submitted_text := public.normalize_answer_text(p_selected->>0);
    foreach v_alt in array string_to_array(coalesce(v_correct->>'text', ''), ';')
    loop
      if v_submitted_text <> '' and v_submitted_text = public.normalize_answer_text(v_alt) then
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

