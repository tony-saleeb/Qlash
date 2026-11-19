-- Fail when a public CHECK calls a public function that authenticated
-- cannot execute. A CHECK runs as the writing role, so a host insert or
-- update otherwise dies with "permission denied for function ...".
do $$
declare
  v_calls int;
  v_missing text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'role authenticated is missing';
  end if;

  -- pg_get_constraintdef omits the schema when the function is in public,
  -- so follow the catalog dependency instead of parsing the definition text.
  select count(distinct p.oid)
    into v_calls
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace tn on tn.oid = c.relnamespace
  join pg_depend d
    on d.classid = 'pg_constraint'::regclass
   and d.objid = con.oid
   and d.refclassid = 'pg_proc'::regclass
   and d.deptype = 'n'
  join pg_proc p on p.oid = d.refobjid
  join pg_namespace fn on fn.oid = p.pronamespace and fn.nspname = 'public'
  where con.contype = 'c'
    and tn.nspname = 'public';

  if v_calls = 0 then
    raise exception 'no public CHECK calls a public function; questions_answers_check should call question_answers_valid';
  end if;

  select string_agg(format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)), ', ' order by p.proname)
    into v_missing
  from (
    select distinct p.oid
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace tn on tn.oid = c.relnamespace
    join pg_depend d
      on d.classid = 'pg_constraint'::regclass
     and d.objid = con.oid
     and d.refclassid = 'pg_proc'::regclass
     and d.deptype = 'n'
    join pg_proc p on p.oid = d.refobjid
    join pg_namespace fn on fn.oid = p.pronamespace and fn.nspname = 'public'
    where con.contype = 'c'
      and tn.nspname = 'public'
      and not has_function_privilege('authenticated', p.oid, 'execute')
  ) missing
  join pg_proc p on p.oid = missing.oid;

  if v_missing is not null then
    raise exception 'authenticated lacks EXECUTE on functions used by public CHECK constraints: %', v_missing;
  end if;

  if not has_function_privilege('authenticated', 'public.question_answers_valid(text, jsonb)', 'execute') then
    raise exception 'authenticated cannot execute question_answers_valid';
  end if;

  if has_function_privilege('anon', 'public.question_answers_valid(text, jsonb)', 'execute') then
    raise exception 'anon must not execute question_answers_valid';
  end if;
end
$$;
