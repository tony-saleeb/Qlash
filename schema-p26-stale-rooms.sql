-- P26: quiet rooms close themselves, and a day-old PIN stops accepting players.
-- last_activity_at moves with every session write. A room with no write for
-- 6 hours is finished. Join also refuses a room opened more than 12 hours ago.

alter table public.game_sessions
  add column if not exists last_activity_at timestamptz;

update public.game_sessions
set last_activity_at = coalesce(updated_at, created_at, now())
where last_activity_at is null;

alter table public.game_sessions
  alter column last_activity_at set default now();

alter table public.game_sessions
  alter column last_activity_at set not null;

create or replace function public.touch_game_session_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  new.last_activity_at := clock_timestamp();
  return new;
end;
$$;

revoke execute on function public.touch_game_session_updated_at() from public, anon, authenticated;

create or replace function public.close_stale_rooms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.game_sessions
  set status = 'finished'
  where status <> 'finished'
    and last_activity_at < now() - interval '6 hours';

  perform public.prune_rate_limit_buckets();
end;
$$;

revoke all on function public.close_stale_rooms() from public, anon, authenticated;
grant execute on function public.close_stale_rooms() to service_role;

-- One-time cleanup of rooms that have already gone quiet.
select public.close_stale_rooms();

-- Schedule the same cleanup every 15 minutes when pg_cron is available.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable: %', sqlerrm;
  end;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'qlash-close-stale-rooms') then
      perform cron.unschedule('qlash-close-stale-rooms');
    end if;
    perform cron.schedule(
      'qlash-close-stale-rooms',
      '*/15 * * * *',
      'select public.close_stale_rooms()'
    );
  end if;
end;
$$;
