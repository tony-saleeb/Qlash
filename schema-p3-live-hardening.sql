-- P3: live-room hardening (run after schema.sql / p2b)
-- Caps inserts at 80 under an advisory lock (closes the count-then-insert race).
-- Also re-run schema-fast-submit.sql so duplicate submits return the stored score.

create or replace function public.enforce_session_player_cap()
returns trigger
language plpgsql
as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtext(NEW.session_id::text));
  select count(*) into n from public.players where session_id = NEW.session_id;
  if n >= 80 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists players_enforce_session_cap on public.players;
create trigger players_enforce_session_cap
  before insert on public.players
  for each row execute procedure public.enforce_session_player_cap();
