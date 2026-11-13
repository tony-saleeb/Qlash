-- P28: a host question bank. Categories and their questions are not quizzes,
-- so they do not consume the free quiz cap. Drawing a quiz still inserts a quiz.

create table public.question_banks (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint question_banks_name_len check (char_length(btrim(name)) between 1 and 40)
);

create unique index question_banks_host_name_idx
  on public.question_banks (host_id, lower(btrim(name)));

create table public.bank_questions (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.question_banks(id) on delete cascade,
  prompt text not null,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  constraint bank_questions_prompt_len check (char_length(btrim(prompt)) between 1 and 150),
  constraint bank_questions_answers_array check (jsonb_typeof(answers) = 'array')
);

create index bank_questions_bank_id_idx
  on public.bank_questions (bank_id, created_at);

alter table public.question_banks enable row level security;
alter table public.bank_questions enable row level security;

create policy question_banks_host on public.question_banks
  for all
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy bank_questions_host on public.bank_questions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.question_banks
      where question_banks.id = bank_questions.bank_id
        and question_banks.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.question_banks
      where question_banks.id = bank_questions.bank_id
        and question_banks.host_id = auth.uid()
    )
  );

revoke all on table public.question_banks from public, anon;
revoke all on table public.bank_questions from public, anon;
grant select, insert, update, delete on table public.question_banks to authenticated;
grant select, insert, update, delete on table public.bank_questions to authenticated;
revoke truncate, trigger, references on table public.question_banks, public.bank_questions from public, anon, authenticated;
