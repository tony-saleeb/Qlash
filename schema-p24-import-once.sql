-- One copy per host per share code. A second import of the same link
-- returns the existing quiz instead of inserting another.

alter table public.quizzes
  add column if not exists imported_share_code text;

create unique index if not exists quizzes_host_imported_share_uidx
  on public.quizzes (host_id, imported_share_code)
  where imported_share_code is not null
    and deleted_at is null;
