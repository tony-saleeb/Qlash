-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Hosts Profiles (synced with auth.users)
create table public.hosts (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'org')),
  ui_locale text not null default 'en' check (ui_locale in ('en', 'ar')),
  created_at timestamptz default now()
);

-- 2. Quizzes (reusable templates)
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.hosts(id) on delete cascade not null,
  title text not null,
  description text,
  cover_image_url text,
  theme jsonb default '{"bgColor": "#0f172a", "textColor": "#ffffff", "primaryColor": "#6366f1"}'::jsonb,
  randomize_questions boolean default false,
  randomize_answers boolean default false,
  team_mode boolean default false,
  double_points_rounds jsonb default '[]'::jsonb, -- question indices or IDs configured at edit time
  share_code text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  order_index int not null,
  type text not null, -- 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll'
  prompt text not null,
  media_url text,
  media_type text, -- 'image' | 'video' | null
  time_limit_seconds int default 20,
  points_base int default 1000,
  scoring_type text default 'linear' not null, -- 'linear' | 'flat' | 'none'
  answers jsonb not null, -- [{id, text, is_correct, color, shape, image_url?}]
  created_at timestamptz default now()
);

-- 4. Game Sessions
-- status: 'lobby' | 'question_active' | 'question_paused' | 'question_reveal' | 'leaderboard' | 'finished'
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete set null,
  host_id uuid references public.hosts(id) on delete cascade not null,
  pin text not null,
  status text default 'lobby' not null,
  current_question_index int default 0 not null,
  question_started_at timestamptz,
  active_multiplier int default 1 not null check (active_multiplier in (1, 2)),
  scores_applied_question_id uuid references public.questions(id) on delete set null,
  scored_question_ids uuid[] not null default '{}',
  question_order jsonb, -- ordered question UUIDs for this live session
  late_join_through_index int not null default 2 check (late_join_through_index >= -1), -- -1 lobby only; >= 0 join until the game ends
  created_at timestamptz default now()
);

-- 5. Players (no auth account; identity via player_tokens)
create table public.players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.game_sessions(id) on delete cascade not null,
  nickname text not null,
  team_name text,
  score int default 0 not null,
  streak int default 0 not null,
  joined_at timestamptz default now(),
  connected boolean default true not null
);

-- 5b. Player tokens (never publicly readable; service-role / security-definer only)
create table public.player_tokens (
  player_id uuid primary key references public.players(id) on delete cascade,
  client_token text not null,
  created_at timestamptz default now()
);

-- 6. Answers Submitted (scoring & anti-cheat source of truth)
create table public.answers_submitted (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.game_sessions(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  selected_answer_ids jsonb not null,
  answered_at timestamptz default now(),
  time_taken_ms int not null,
  points_awarded int not null,
  is_correct boolean not null,
  was_late boolean not null default false,
  unique(session_id, question_id, player_id)
);

-- Indexes for ~80-player hot paths
create index players_session_id_idx on public.players(session_id);
create unique index players_session_nickname_uidx on public.players (session_id, lower(nickname));
create index answers_session_question_idx on public.answers_submitted(session_id, question_id);
create unique index game_sessions_pin_live_uidx on public.game_sessions (pin) where status <> 'finished';
create unique index player_tokens_token_idx on public.player_tokens(client_token);

-- Enable Row Level Security
alter table public.hosts enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.game_sessions enable row level security;
alter table public.players enable row level security;
alter table public.player_tokens enable row level security;
alter table public.answers_submitted enable row level security;

-- RLS Policies

-- Hosts
create policy "Hosts can read own profile" on public.hosts
  for select using (auth.uid() = id);
create policy "Hosts can update own profile" on public.hosts
  for update using (auth.uid() = id);

-- Quizzes: hosts manage. Public dump is closed (join uses /api/player/room).
create policy "Hosts can manage own quizzes" on public.quizzes
  for all using (auth.uid() = host_id);

-- Questions: hosts only (answer keys must never be public)
create policy "Hosts can manage own quiz questions" on public.questions
  for all using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = questions.quiz_id and quizzes.host_id = auth.uid()
    )
  );

-- Game Sessions
create policy "Hosts can manage own game sessions" on public.game_sessions
  for all using (auth.uid() = host_id);

-- Players: writes via service role / host only. Anonymous reads are closed.
create policy "Hosts can manage players" on public.players
  for all using (
    exists (
      select 1 from public.game_sessions
      where game_sessions.id = players.session_id and game_sessions.host_id = auth.uid()
    )
  );
-- No public INSERT/UPDATE — join & connection updates go through Next.js APIs (service role)

-- player_tokens: no policies → denied for anon/authenticated (service role bypasses RLS)

-- Answers: hosts only (players fetch own row via /api/player/round-result)
create policy "Hosts can read answers submitted" on public.answers_submitted
  for select using (
    exists (
      select 1 from public.game_sessions
      where game_sessions.id = answers_submitted.session_id and game_sessions.host_id = auth.uid()
    )
  );

-- Batch score apply + idempotent reveal (security definer; caller must be session host)
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

  -- Idempotent: this question was already scored (including after Jump-back)
  if v_session.scores_applied_question_id is not distinct from p_question_id
     or p_question_id = any(coalesce(v_session.scored_question_ids, '{}'::uuid[])) then
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

  -- Single-statement score/streak update for all players in the session
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

-- Triggers

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hosts (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Realtime
alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.answers_submitted;

alter table public.players replica identity full;

-- P15: anonymous table reads are closed. Realtime policy helpers are security definer.
revoke select on table public.game_sessions from anon;
revoke select on table public.players from anon;

grant select, insert, update, delete on table public.game_sessions to authenticated;

comment on column public.game_sessions.late_join_through_index is
  '-1 lobby only; any value >= 0 means join until the game ends.';

create or replace function public.enforce_quiz_library_cap()
returns trigger
language plpgsql
as $$
declare
  n int;
  plan text;
begin
  select hosts.plan into plan from public.hosts where id = NEW.host_id;
  if plan in ('pro', 'org') then
    return NEW;
  end if;
  perform pg_advisory_xact_lock(hashtext('quiz-cap:' || NEW.host_id::text));
  select count(*) into n from public.quizzes where host_id = NEW.host_id;
  if n >= 5 then
    raise exception 'QUIZ_CAP' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists quizzes_enforce_library_cap on public.quizzes;
create trigger quizzes_enforce_library_cap
  before insert on public.quizzes
  for each row execute procedure public.enforce_quiz_library_cap();

-- Live rooms cap at 80. Advisory lock closes the count-then-insert race.
create or replace function public.enforce_session_player_cap()
returns trigger
language plpgsql
as $$
declare
  n int;
  v_cap int := 80;
begin
  perform pg_advisory_xact_lock(hashtext(NEW.session_id::text));
  v_cap := 80;
  select count(*) into n from public.players where session_id = NEW.session_id;
  if n >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists players_enforce_session_cap on public.players;
create trigger players_enforce_session_cap
  before insert on public.players
  for each row execute procedure public.enforce_session_player_cap();

-- P10 bootstrap: Postgres stamps the question clock. Full grader is schema-p10-late-grading.sql.
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

-- P11 bootstrap: one-shot live lobby. Full function is schema-p11-fast-lobby.sql.
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

-- P12: grants, ownership, host columns, PIN lifecycle. Migration: schema-p12-hardening.sql.
-- submit_live_answer is created by schema-fast-submit.sql / schema-p10-late-grading.sql, so its
-- EXECUTE revoke lives in schema-p12-hardening.sql, which runs after those files.

create or replace function public.enforce_session_quiz_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quiz_id is null or (select auth.uid()) is null then
    return new;
  end if;
  if not exists (
    select 1 from public.quizzes q
    where q.id = new.quiz_id and q.host_id = (select auth.uid())
  ) then
    raise exception 'QUIZ_NOT_OWNED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_session_quiz_owner() from public, anon, authenticated;
drop trigger if exists game_sessions_enforce_quiz_owner on public.game_sessions;
create trigger game_sessions_enforce_quiz_owner
  before insert or update of quiz_id on public.game_sessions
  for each row execute function public.enforce_session_quiz_owner();

revoke update on table public.hosts from anon, authenticated;
grant update (display_name, ui_locale) on table public.hosts to authenticated;

revoke execute on function public.apply_question_scores_and_reveal(uuid, uuid) from public, anon;
revoke execute on function public.start_question_clock(uuid) from public, anon;
revoke execute on function public.create_live_lobby(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_quiz_library_cap() from public, anon, authenticated;
revoke execute on function public.enforce_session_player_cap() from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- P13 mirror of schema-p13-live-rpcs.sql
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

-- P14 mirror of schema-p14-realtime-auth.sql
-- P14: Realtime authorization. Players read, only the session's host writes,
-- state and kicks are broadcast by Postgres itself.
create schema if not exists qlash_private;
revoke all on schema qlash_private from public;
grant usage on schema qlash_private to anon, authenticated;

create or replace function qlash_private.session_id_from_topic(p_topic text, p_suffix text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_topic is null or left(p_topic, 8) <> 'session:' then
    return null;
  end if;
  v := substr(p_topic, 9);
  if coalesce(p_suffix, '') <> '' then
    if right(v, length(p_suffix)) <> p_suffix then
      return null;
    end if;
    v := left(v, length(v) - length(p_suffix));
  end if;
  if v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v::uuid;
end;
$$;

create or replace function qlash_private.can_read_session_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_sessions gs
    where gs.id = qlash_private.session_id_from_topic(p_topic, '')
  );
$$;

create or replace function qlash_private.is_session_host_topic(p_topic text, p_suffix text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_sessions gs
    where gs.id = qlash_private.session_id_from_topic(p_topic, p_suffix)
      and gs.host_id = (select auth.uid())
  );
$$;

revoke all on function qlash_private.session_id_from_topic(text, text) from public;
revoke all on function qlash_private.can_read_session_topic(text) from public;
revoke all on function qlash_private.is_session_host_topic(text, text) from public;
grant execute on function qlash_private.session_id_from_topic(text, text) to anon, authenticated;
grant execute on function qlash_private.can_read_session_topic(text) to anon, authenticated;
grant execute on function qlash_private.is_session_host_topic(text, text) to anon, authenticated;

drop policy if exists "qlash: read session topic" on realtime.messages;
create policy "qlash: read session topic" on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and qlash_private.can_read_session_topic((select realtime.topic()))
  );

drop policy if exists "qlash: host sends on session topic" on realtime.messages;
create policy "qlash: host sends on session topic" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and qlash_private.is_session_host_topic((select realtime.topic()), '')
  );

drop policy if exists "qlash: host reads host topic" on realtime.messages;
create policy "qlash: host reads host topic" on realtime.messages
  for select to authenticated
  using (qlash_private.is_session_host_topic((select realtime.topic()), ':host'));

create or replace function qlash_private.broadcast_session_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.status, new.current_question_index, new.question_started_at, new.active_multiplier)
     is not distinct from
     (old.status, old.current_question_index, old.question_started_at, old.active_multiplier) then
    return null;
  end if;
  begin
    perform realtime.send(
      jsonb_build_object('new', jsonb_build_object(
        'id', new.id,
        'status', new.status,
        'current_question_index', new.current_question_index,
        'question_started_at', new.question_started_at,
        'active_multiplier', new.active_multiplier
      )),
      'session:state',
      'session:' || new.id::text,
      true
    );
  exception when others then
    raise warning 'qlash: state broadcast failed for %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create or replace function qlash_private.broadcast_player_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('player_id', old.id),
      'player:removed',
      'session:' || old.session_id::text,
      true
    );
  exception when others then
    raise warning 'qlash: removal broadcast failed for %: %', old.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function qlash_private.broadcast_session_state() from public, anon, authenticated;
revoke all on function qlash_private.broadcast_player_removed() from public, anon, authenticated;

drop trigger if exists game_sessions_broadcast_state on public.game_sessions;
create trigger game_sessions_broadcast_state
  after update on public.game_sessions
  for each row execute function qlash_private.broadcast_session_state();

drop trigger if exists players_broadcast_removed on public.players;
create trigger players_broadcast_removed
  after delete on public.players
  for each row execute function qlash_private.broadcast_player_removed();

-- Lobby reactions: the API route validates the player and rate-limits, then
-- Postgres delivers to the host-only topic. Phones never write to Realtime.
create or replace function public.send_lobby_reaction(p_session_id uuid, p_mark text, p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mark not in ('slash', 'qring', 'bolt', 'chevron') then
    raise exception 'INVALID_MARK';
  end if;
  perform realtime.send(
    jsonb_build_object('mark', p_mark, 'nickname', left(coalesce(p_nickname, ''), 15)),
    'lobby:react',
    'session:' || p_session_id::text || ':host',
    true
  );
end;
$$;
revoke all on function public.send_lobby_reaction(uuid, text, text) from public, anon, authenticated;
grant execute on function public.send_lobby_reaction(uuid, text, text) to service_role;
