-- P27: cap triggers stay on the public schema, and the Data API roles
-- lose TRUNCATE, TRIGGER, and REFERENCES. Row security already blocks
-- ordinary reads and writes. New tables keep that lock when the role
-- running this file is allowed to change default privileges.

alter function public.enforce_quiz_library_cap() set search_path = public;
alter function public.enforce_session_player_cap() set search_path = public;

revoke truncate, trigger, references on table
  public.answers_submitted,
  public.game_sessions,
  public.hosts,
  public.player_tokens,
  public.players,
  public.questions,
  public.quizzes,
  public.rate_limit_buckets,
  public.session_kicks
from anon, authenticated;

do $defaults$
begin
  begin
    execute 'alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from anon, authenticated';
  exception
    when insufficient_privilege then
      raise notice 'postgres default privileges unchanged';
  end;
  begin
    execute 'alter default privileges for role supabase_admin in schema public revoke truncate, trigger, references on tables from anon, authenticated';
  exception
    when insufficient_privilege then
      raise notice 'supabase_admin default privileges unchanged';
  end;
end
$defaults$;
