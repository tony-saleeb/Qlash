-- P14: Realtime authorization. Players read, only the session's host writes,
-- state and kicks are broadcast by Postgres itself.
create schema if not exists qlash_private;
revoke all on schema qlash_private from public;
grant usage on schema qlash_private to anon, authenticated;

create or replace function qlash_private.session_id_from_topic(p_topic text, p_suffix text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_topic is null or left(p_topic, 8) <> 'session:' then
    return null;
  end if;
  v := substr(p_topic, 9);
  if coalesce(p_suffix, '') <> '' then
    if right(v, length(p_suffix)) <> p_suffix then
      return null;
    end if;
    v := left(v, length(v) - length(p_suffix));
  end if;
  if v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v::uuid;
end;
$$;

create or replace function qlash_private.can_read_session_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_sessions gs
    where gs.id = qlash_private.session_id_from_topic(p_topic, '')
  );
$$;

create or replace function qlash_private.is_session_host_topic(p_topic text, p_suffix text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_sessions gs
    where gs.id = qlash_private.session_id_from_topic(p_topic, p_suffix)
      and gs.host_id = (select auth.uid())
  );
$$;

revoke all on function qlash_private.session_id_from_topic(text, text) from public;
revoke all on function qlash_private.can_read_session_topic(text) from public;
revoke all on function qlash_private.is_session_host_topic(text, text) from public;
grant execute on function qlash_private.session_id_from_topic(text, text) to anon, authenticated;
grant execute on function qlash_private.can_read_session_topic(text) to anon, authenticated;
grant execute on function qlash_private.is_session_host_topic(text, text) to anon, authenticated;

drop policy if exists "qlash: read session topic" on realtime.messages;
create policy "qlash: read session topic" on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and qlash_private.can_read_session_topic((select realtime.topic()))
  );

drop policy if exists "qlash: host sends on session topic" on realtime.messages;
create policy "qlash: host sends on session topic" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and qlash_private.is_session_host_topic((select realtime.topic()), '')
  );

drop policy if exists "qlash: host reads host topic" on realtime.messages;
create policy "qlash: host reads host topic" on realtime.messages
  for select to authenticated
  using (qlash_private.is_session_host_topic((select realtime.topic()), ':host'));

create or replace function qlash_private.broadcast_session_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.status, new.current_question_index, new.question_started_at, new.active_multiplier)
     is not distinct from
     (old.status, old.current_question_index, old.question_started_at, old.active_multiplier) then
    return null;
  end if;
  begin
    perform realtime.send(
      jsonb_build_object('new', jsonb_build_object(
        'id', new.id,
        'status', new.status,
        'current_question_index', new.current_question_index,
        'question_started_at', new.question_started_at,
        'active_multiplier', new.active_multiplier
      )),
      'session:state',
      'session:' || new.id::text,
      true
    );
  exception when others then
    raise warning 'qlash: state broadcast failed for %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create or replace function qlash_private.broadcast_player_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('player_id', old.id),
      'player:removed',
      'session:' || old.session_id::text,
      true
    );
  exception when others then
    raise warning 'qlash: removal broadcast failed for %: %', old.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function qlash_private.broadcast_session_state() from public, anon, authenticated;
revoke all on function qlash_private.broadcast_player_removed() from public, anon, authenticated;

drop trigger if exists game_sessions_broadcast_state on public.game_sessions;
create trigger game_sessions_broadcast_state
  after update on public.game_sessions
  for each row execute function qlash_private.broadcast_session_state();

drop trigger if exists players_broadcast_removed on public.players;
create trigger players_broadcast_removed
  after delete on public.players
  for each row execute function qlash_private.broadcast_player_removed();

-- Lobby reactions: the API route validates the player and rate-limits, then
-- Postgres delivers to the host-only topic. Phones never write to Realtime.
create or replace function public.send_lobby_reaction(p_session_id uuid, p_mark text, p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mark not in ('slash', 'qring', 'bolt', 'chevron') then
    raise exception 'INVALID_MARK';
  end if;
  perform realtime.send(
    jsonb_build_object('mark', p_mark, 'nickname', left(coalesce(p_nickname, ''), 15)),
    'lobby:react',
    'session:' || p_session_id::text || ':host',
    true
  );
end;
$$;
revoke all on function public.send_lobby_reaction(uuid, text, text) from public, anon, authenticated;
grant execute on function public.send_lobby_reaction(uuid, text, text) to service_role;
