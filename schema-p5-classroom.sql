-- P5: classroom flow — late join through the first questions.
-- Run after schema-p4-ops.sql.
-- late_join_through_index: -1 = lobby only; 2 = through question 3 (default).

alter table public.game_sessions
  add column if not exists late_join_through_index int not null default 2;

alter table public.game_sessions
  drop constraint if exists game_sessions_late_join_through_index_check;
alter table public.game_sessions
  add constraint game_sessions_late_join_through_index_check
  check (late_join_through_index >= -1);
