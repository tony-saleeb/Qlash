-- Confirm schema-p4-ops.sql is live. Run in the Supabase SQL editor.
-- If either query returns 0 rows, re-run schema-p4-ops.sql.
-- Without this RPC, Qlash falls back to in-memory limits (wrong on multi-instance Vercel).

select proname
from pg_proc
where proname = 'consume_rate_limit';

select to_regclass('public.rate_limit_buckets') as rate_limit_buckets;
