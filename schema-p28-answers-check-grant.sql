-- P28: questions_answers_check calls question_answers_valid, and a CHECK
-- constraint runs as the writing role. P19 revoked EXECUTE from
-- authenticated, which broke every host question write. anon stays
-- revoked so the function is not exposed as a PostgREST RPC.
grant execute on function public.question_answers_valid(text, jsonb)
  to authenticated, service_role;
