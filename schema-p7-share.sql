-- P7: share a quiz with another host via a short code. Run after schema-p6-locale.sql.

alter table public.quizzes
  add column if not exists share_code text;

create unique index if not exists quizzes_share_code_key
  on public.quizzes (share_code)
  where share_code is not null;
