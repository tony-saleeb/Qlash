-- P4: production ops — host plans + shared rate-limit buckets.
-- Run after schema-p3-live-hardening.sql.

alter table public.hosts
  add column if not exists plan text not null default 'free';

alter table public.hosts
  drop constraint if exists hosts_plan_check;
alter table public.hosts
  add constraint hosts_plan_check check (plan in ('free', 'pro', 'org'));

create table if not exists public.rate_limit_buckets (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit int,
  p_window_ms int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_reset timestamptz := v_now + (p_window_ms::text || ' milliseconds')::interval;
  v_count int;
  v_reset_at timestamptz;
begin
  if p_key is null or p_key = '' or p_limit < 1 or p_window_ms < 1 then
    return jsonb_build_object('ok', false, 'retryAfterSec', 1);
  end if;

  insert into public.rate_limit_buckets as b (key, count, reset_at)
  values (p_key, 1, v_reset)
  on conflict (key) do update
    set count = case
      when b.reset_at <= v_now then 1
      else b.count + 1
    end,
    reset_at = case
      when b.reset_at <= v_now then excluded.reset_at
      else b.reset_at
    end
  returning b.count, b.reset_at into v_count, v_reset_at;

  if v_count <= p_limit then
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object(
    'ok', false,
    'retryAfterSec', greatest(1, ceil(extract(epoch from (v_reset_at - v_now))))
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;
grant all on table public.rate_limit_buckets to service_role;

create or replace function public.enforce_session_player_cap()
returns trigger
language plpgsql
as $$
declare
  n int;
  v_cap int := 80;
begin
  perform pg_advisory_xact_lock(hashtext(NEW.session_id::text));
  select case coalesce(h.plan, 'free')
    when 'free' then 30
    else 80
  end
    into v_cap
  from public.game_sessions s
  left join public.hosts h on h.id = s.host_id
  where s.id = NEW.session_id;

  v_cap := coalesce(v_cap, 80);
  select count(*) into n from public.players where session_id = NEW.session_id;
  if n >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;
