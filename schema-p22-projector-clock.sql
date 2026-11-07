-- P22: the projector learns the database clock on load and on every session write.
-- A reload, or the phone clicker advancing the room, no longer times the round
-- with the laptop clock alone.

alter table public.game_sessions
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_game_session_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists game_sessions_touch_updated_at on public.game_sessions;
create trigger game_sessions_touch_updated_at
  before update on public.game_sessions
  for each row
  execute function public.touch_game_session_updated_at();

revoke execute on function public.touch_game_session_updated_at() from public, anon, authenticated;

create or replace function public.server_now()
returns timestamptz
language sql
stable
security invoker
set search_path = public
as $$
  select now();
$$;

revoke execute on function public.server_now() from public, anon;
grant execute on function public.server_now() to authenticated;
