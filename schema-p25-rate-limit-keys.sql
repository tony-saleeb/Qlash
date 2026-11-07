-- Rate-limit keys are hashed, and expired buckets are deleted.
-- A raw key longer than a btree entry used to fail this RPC and
-- switch that server onto the weaker in-memory limiter for a minute.

create index if not exists rate_limit_buckets_reset_at_idx
  on public.rate_limit_buckets (reset_at);

create or replace function public.prune_rate_limit_buckets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with doomed as (
    select key
    from public.rate_limit_buckets
    where reset_at <= clock_timestamp()
    limit 500
  )
  delete from public.rate_limit_buckets as b
  using doomed
  where b.key = doomed.key;
  get diagnostics n = row_count;
  return n;
end;
$$;

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
  v_key text;
  v_count int;
  v_reset_at timestamptz;
begin
  if p_key is null or length(btrim(p_key)) = 0 or p_limit < 1 or p_window_ms < 1 then
    return jsonb_build_object('ok', false, 'retryAfterSec', 1);
  end if;

  v_key := md5(left(p_key, 512));

  insert into public.rate_limit_buckets as b (key, count, reset_at)
  values (v_key, 1, v_reset)
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

  if v_count = 1 then
    perform public.prune_rate_limit_buckets();
  end if;

  if v_count <= p_limit then
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object(
    'ok', false,
    'retryAfterSec', greatest(1, ceil(extract(epoch from (v_reset_at - v_now))))
  );
end;
$$;

revoke all on function public.prune_rate_limit_buckets() from public, anon, authenticated;
grant execute on function public.prune_rate_limit_buckets() to service_role;
revoke all on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;
