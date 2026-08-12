-- P2b: concurrency safety for ~80-player rooms
-- Unique nicknames per session (prevents racey duplicate joins)
create unique index if not exists players_session_nickname_uidx
  on public.players (session_id, lower(nickname));

-- Speeds lobby capacity checks and reconnect lookups
create index if not exists players_session_nickname_idx
  on public.players (session_id, nickname);
