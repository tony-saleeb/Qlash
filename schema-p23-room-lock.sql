-- P23: the host can lock joins, and a kicked player cannot walk back in.

alter table public.game_sessions
  add column if not exists join_locked boolean not null default false;

create table if not exists public.session_kicks (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  nickname text not null,
  client_token text,
  created_at timestamptz not null default now(),
  primary key (session_id, nickname)
);

create unique index if not exists session_kicks_token_uidx
  on public.session_kicks (session_id, client_token)
  where client_token is not null;

alter table public.session_kicks enable row level security;

revoke all on table public.session_kicks from public, anon, authenticated;
