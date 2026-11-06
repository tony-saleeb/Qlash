-- P12: hardening — function grants, session/quiz ownership, host columns, PIN lifecycle, bucket limits.
-- 1. EXECUTE: only the roles that actually call each function
revoke execute on function public.submit_live_answer(uuid, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_live_answer(uuid, text, uuid, uuid, jsonb) to service_role;
revoke execute on function public.apply_question_scores_and_reveal(uuid, uuid) from public, anon;
revoke execute on function public.start_question_clock(uuid) from public, anon;
revoke execute on function public.create_live_lobby(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_quiz_library_cap() from public, anon, authenticated;
revoke execute on function public.enforce_session_player_cap() from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 2. handle_new_user: pinned search_path
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

-- 3. a session may only point at the caller's own quiz
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

-- 4. hosts: only profile columns writable
revoke update on table public.hosts from anon, authenticated;
grant update (display_name, ui_locale) on table public.hosts to authenticated;

-- 5. PIN unique among unfinished games only
do $$
declare
  v_con text;
  v_dupes int;
begin
  select count(*) into v_dupes from (
    select pin from public.game_sessions where status <> 'finished' group by pin having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'Found % duplicate live PINs; resolve before migrating', v_dupes;
  end if;
  select c.conname into v_con
  from pg_constraint c
  where c.conrelid = 'public.game_sessions'::regclass
    and c.contype = 'u'
    and c.conkey = array[(select a.attnum from pg_attribute a
                          where a.attrelid = 'public.game_sessions'::regclass and a.attname = 'pin')]::smallint[];
  if v_con is not null then
    execute format('alter table public.game_sessions drop constraint %I', v_con);
  end if;
end $$;
drop index if exists public.game_sessions_pin_idx;
create unique index if not exists game_sessions_pin_live_uidx
  on public.game_sessions (pin) where status <> 'finished';

-- 6. bucket limits enforced server-side
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
where id = 'question-media';
