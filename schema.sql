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
  pin text unique not null,
  status text default 'lobby' not null,
  current_question_index int default 0 not null,
  question_started_at timestamptz,
  active_multiplier int default 1 not null check (active_multiplier in (1, 2)),
  scores_applied_question_id uuid references public.questions(id) on delete set null,
  question_order jsonb, -- ordered question UUIDs for this live session
  late_join_through_index int not null default 2 check (late_join_through_index >= -1), -- -1 lobby only; 2 = through Q3
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
  unique(session_id, question_id, player_id)
);

-- Indexes for ~80-player hot paths
create index players_session_id_idx on public.players(session_id);
create unique index players_session_nickname_uidx on public.players (session_id, lower(nickname));
create index answers_session_question_idx on public.answers_submitted(session_id, question_id);
create index game_sessions_pin_idx on public.game_sessions(pin);
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

-- Quizzes: hosts manage; public can read metadata (join needs team_mode / theme)
create policy "Hosts can manage own quizzes" on public.quizzes
  for all using (auth.uid() = host_id);
create policy "Public can view quizzes" on public.quizzes
  for select using (true);

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
create policy "Public can view game sessions" on public.game_sessions
  for select using (true);

-- Players: public read for lobby/leaderboard; writes via service role / host only
create policy "Hosts can manage players" on public.players
  for all using (
    exists (
      select 1 from public.game_sessions
      where game_sessions.id = players.session_id and game_sessions.host_id = auth.uid()
    )
  );
create policy "Public can view players" on public.players
  for select using (true);
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

  -- Idempotent: scores already applied for this question
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

  -- Single-statement score/streak update for all players in the session
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

-- Triggers

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.hosts (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Realtime
alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.answers_submitted;

alter table public.players replica identity full;
