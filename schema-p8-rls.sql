-- P8: tighten public reads + enforce the free quiz cap in Postgres.
-- Run after schema-p7-share.sql.
-- Player phones still need SELECT on game_sessions/players for Realtime kick/clock.
-- PINs are no longer selectable by anon (hosts keep full row access).

drop policy if exists "Public can view quizzes" on public.quizzes;

revoke select on table public.game_sessions from anon;
grant select (
  id,
  quiz_id,
  host_id,
  status,
  current_question_index,
  question_started_at,
  active_multiplier,
  scores_applied_question_id,
  question_order,
  late_join_through_index,
  created_at
) on table public.game_sessions to anon;

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
