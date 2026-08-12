-- P0 migration for existing QuizArena databases.
-- Run in Supabase SQL editor after backing up.
-- Safe to re-run sections that use IF EXISTS / IF NOT EXISTS where noted.

-- 1. Session fields: live 2x multiplier + idempotent reveal tracking
alter table public.game_sessions
  add column if not exists active_multiplier int default 1 not null;

alter table public.game_sessions
  drop constraint if exists game_sessions_active_multiplier_check;

alter table public.game_sessions
  add constraint game_sessions_active_multiplier_check
  check (active_multiplier in (1, 2));

alter table public.game_sessions
  add column if not exists scores_applied_question_id uuid references public.questions(id) on delete set null;

comment on column public.game_sessions.status is
  'lobby | question_active | question_paused | question_reveal | leaderboard | finished';

-- 2. Team name on players
alter table public.players
  add column if not exists team_name text;

-- 3. Move client_token off publicly-readable players table
create table if not exists public.player_tokens (
  player_id uuid primary key references public.players(id) on delete cascade,
  client_token text not null,
  created_at timestamptz default now()
);

create unique index if not exists player_tokens_token_idx
  on public.player_tokens(client_token);

alter table public.player_tokens enable row level security;

-- Copy existing tokens if players.client_token still exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'players' and column_name = 'client_token'
  ) then
    insert into public.player_tokens (player_id, client_token)
    select id, client_token from public.players
    where client_token is not null
    on conflict (player_id) do nothing;

    alter table public.players drop column client_token;
  end if;
end $$;

-- 4. Hot-path indexes
create index if not exists players_session_id_idx on public.players(session_id);
create index if not exists answers_session_question_idx
  on public.answers_submitted(session_id, question_id);
create index if not exists game_sessions_pin_idx on public.game_sessions(pin);

-- 5. Drop permissive policies
drop policy if exists "Public can view questions" on public.questions;
drop policy if exists "Public can view answers submitted" on public.answers_submitted;
drop policy if exists "Players can update own record" on public.players;
drop policy if exists "Public can join games" on public.players;

-- 6. Ensure host-only answer reads remain
drop policy if exists "Hosts can read answers submitted" on public.answers_submitted;
create policy "Hosts can read answers submitted" on public.answers_submitted
  for select using (
    exists (
      select 1 from public.game_sessions
      where game_sessions.id = answers_submitted.session_id
        and game_sessions.host_id = auth.uid()
    )
  );

-- 7. Batch reveal RPC
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

  if v_session.scores_applied_question_id is not distinct from p_question_id then
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
