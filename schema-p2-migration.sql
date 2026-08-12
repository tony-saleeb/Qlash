-- P2: persist play order so player hydrate matches host shuffle
alter table public.game_sessions
  add column if not exists question_order jsonb;

comment on column public.game_sessions.question_order is
  'Ordered question UUIDs for this live session (supports randomize_questions)';
