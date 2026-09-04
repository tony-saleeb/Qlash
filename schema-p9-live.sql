-- P9: Jump-back must not re-add scores; authenticated hosts must not list every PIN.
-- Run after schema-p8-rls.sql.
-- Player phones still need SELECT on game_sessions (no pin) and players (kick Realtime).

alter table public.game_sessions
  add column if not exists scored_question_ids uuid[] not null default '{}';

grant select (scored_question_ids) on table public.game_sessions to anon;

drop policy if exists "Public can view game sessions" on public.game_sessions;
drop policy if exists "Anon can read live session clock" on public.game_sessions;

create policy "Anon can read live session clock" on public.game_sessions
  for select to anon
  using (true);

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
    streak = case when s.is_correct is true then p.streak + 1 else 0 end
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
