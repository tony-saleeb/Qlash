-- Confirm schema-p4-ops.sql is live. Run in the Supabase SQL editor.
-- If either query returns 0 rows, re-run schema-p4-ops.sql.
-- Without this RPC, Qlash falls back to in-memory limits (wrong on multi-instance Vercel).

select proname
from pg_proc
where proname = 'consume_rate_limit';

select to_regclass('public.rate_limit_buckets') as rate_limit_buckets;

select to_regprocedure('public.prune_rate_limit_buckets()') as prune_rate_limit_buckets;

select position(
  'md5' in pg_get_functiondef('public.consume_rate_limit(text,int,int)'::regprocedure)
) > 0 as keys_are_hashed;
