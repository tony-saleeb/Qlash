-- P20: one poll vote is one vote. Choice ids must belong to the question,
-- and a typed answer is capped at 80 characters.

create or replace function public.answer_selection_valid(
  p_type text,
  p_answers jsonb,
  p_selected jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_selected) is distinct from 'array' then false
    when jsonb_array_length(p_selected) not between 1 and 6 then false
    when exists (
      select 1
      from jsonb_array_elements(p_selected) elem
      where jsonb_typeof(elem) is distinct from 'string'
         or char_length(elem #>> '{}') = 0
         or char_length(elem #>> '{}') > 80
    ) then false
    when (
      select count(*) from jsonb_array_elements(p_selected)
    ) is distinct from (
      select count(distinct elem #>> '{}') from jsonb_array_elements(p_selected) elem
    ) then false
    when p_type = 'type_answer' then jsonb_array_length(p_selected) = 1
    when p_type = 'multi_select' then not exists (
      select 1
      from jsonb_array_elements_text(p_selected) picked
      where not exists (
        select 1
        from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) answer
        where answer->>'id' = picked
      )
    )
    when p_type in ('mcq', 'true_false', 'poll') then
      jsonb_array_length(p_selected) = 1
      and exists (
        select 1
        from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) answer
        where answer->>'id' = p_selected->>0
      )
    else false
  end;
$$;

revoke all on function public.answer_selection_valid(text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.reject_stuffed_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_answers jsonb;
begin
  select q.type, q.answers into v_type, v_answers
  from public.questions q
  where q.id = new.question_id;
  if not found or not public.answer_selection_valid(v_type, v_answers, new.selected_answer_ids) then
    raise exception 'INVALID_ANSWER' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_stuffed_answer() from public, anon, authenticated;

drop trigger if exists answers_submitted_reject_stuffed on public.answers_submitted;
create trigger answers_submitted_reject_stuffed
  before insert on public.answers_submitted
  for each row
  execute function public.reject_stuffed_answer();
