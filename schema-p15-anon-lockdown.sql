-- P15: phones no longer read tables. Close anonymous reads.
drop policy if exists "Public can view players" on public.players;
drop policy if exists "Anon can read live session clock" on public.game_sessions;
revoke select on table public.players from anon;
revoke select on table public.game_sessions from anon;
