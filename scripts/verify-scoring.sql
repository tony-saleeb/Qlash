-- Scoring contract check. Paste into the Supabase SQL editor and run.
--
-- Replays src/lib/game/scoringFixture.ts through the real submit_live_answer
-- RPC and prints one line per case. Everything happens inside a transaction
-- that rolls back, so no quiz, session, player, or answer survives the run.
--
-- Requires: at least one row in public.hosts (sign up once), plus
-- schema-fast-submit.sql already applied.
--
-- Linear cases allow 2 points of slack: this script sets question_started_at
-- and then calls the RPC, so a few milliseconds of real time always elapse.
-- Flat and none cases are time-independent and must match exactly.

begin;

do $$
declare
  v_host uuid;
  v_quiz uuid;
  v_session uuid;
  v_player uuid;
  v_question uuid;
  v_result jsonb;
  v_points int;
  v_correct boolean;
  v_streak int;
  v_slack int;
  v_ok boolean;
  v_pass int := 0;
  v_fail int := 0;
  c record;
begin
  select id into v_host from public.hosts limit 1;
  if v_host is null then
    raise exception 'No rows in public.hosts. Sign up as a host once, then re-run.';
  end if;

  insert into public.quizzes (host_id, title, description)
  values (v_host, 'scoring contract probe', 'temporary — rolled back')
  returning id into v_quiz;

  for c in
    select *
    from (
      values
        ('mcq instant answer takes full base',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 0, 20, 1000, 'linear', 0, 1, true, 1000, 1),

        ('mcq at half the clock decays to 75 percent and adds a streak bonus',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 10000, 20, 1000, 'linear', 2, 1, true, 850, 3),

        ('mcq on the final tick floors at half base',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 20000, 20, 1000, 'linear', 0, 1, true, 500, 1),

        ('wrong mcq scores nothing and breaks the streak',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["1"]'::jsonb, 3000, 20, 1000, 'linear', 4, 1, false, 0, 0),

        ('an answer inside the 1500ms grace still counts',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 21000, 20, 1000, 'linear', 5, 1, true, 750, 6),

        ('an answer past the grace is late and scores nothing',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 21501, 20, 1000, 'linear', 5, 1, false, 0, 0),

        ('multi_select accepts the exact set in any order',
         'multi_select', '[{"id":"1","text":"Tout","is_correct":true},{"id":"2","text":"Baba","is_correct":true},{"id":"3","text":"Kiahk","is_correct":false}]'::jsonb,
         '["2","1"]'::jsonb, 0, 30, 800, 'linear', 0, 1, true, 800, 1),

        ('multi_select rejects a partial set',
         'multi_select', '[{"id":"1","text":"Tout","is_correct":true},{"id":"2","text":"Baba","is_correct":true},{"id":"3","text":"Kiahk","is_correct":false}]'::jsonb,
         '["1"]'::jsonb, 0, 30, 800, 'linear', 1, 1, false, 0, 0),

        ('type_answer folds case, trims, and accepts a semicolon alternative',
         'type_answer', '[{"id":"1","text":"Nayrouz;النيروز","is_correct":true}]'::jsonb,
         '["  NAYROUZ "]'::jsonb, 4000, 25, 500, 'flat', 0, 1, true, 500, 1),

        ('type_answer accepts the Arabic alternative',
         'type_answer', '[{"id":"1","text":"Nayrouz;النيروز","is_correct":true}]'::jsonb,
         '["النيروز"]'::jsonb, 4000, 25, 500, 'flat', 0, 1, true, 500, 1),

        ('a poll is never correct and never scores',
         'poll', '[{"id":"1","text":"Yes","is_correct":false},{"id":"2","text":"No","is_correct":false}]'::jsonb,
         '["1"]'::jsonb, 1000, 20, 1000, 'none', 3, 1, false, 0, 0),

        ('scoring_type none still pays the streak bonus',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 0, 20, 1000, 'none', 2, 1, true, 100, 3),

        ('double points applies after the streak bonus',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 1000, 20, 1000, 'flat', 1, 2, true, 2100, 2),

        ('streak bonus caps at 250',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 0, 20, 1000, 'flat', 20, 1, true, 1250, 21),

        ('a missing time limit pays full base instead of decaying',
         'mcq', '[{"id":"1","text":"Cairo","is_correct":false},{"id":"2","text":"Alexandria","is_correct":true}]'::jsonb,
         '["2"]'::jsonb, 0, 0, 1000, 'linear', 0, 1, true, 1000, 1)
    ) as t(
      name, qtype, answers, selected, time_taken_ms, limit_s, base,
      scoring, prev_streak, mult, exp_correct, exp_points, exp_streak
    )
  loop
    insert into public.questions (
      quiz_id, order_index, type, prompt, time_limit_seconds,
      points_base, scoring_type, answers
    )
    values (v_quiz, 0, c.qtype, c.name, c.limit_s, c.base, c.scoring, c.answers)
    returning id into v_question;

    insert into public.game_sessions (
      quiz_id, host_id, pin, status, current_question_index,
      active_multiplier, question_order
    )
    values (
      v_quiz, v_host, 'probe-' || substr(gen_random_uuid()::text, 1, 8),
      'question_active', 0, c.mult, jsonb_build_array(v_question::text)
    )
    returning id into v_session;

    insert into public.players (session_id, nickname, streak)
    values (v_session, 'probe', c.prev_streak)
    returning id into v_player;

    insert into public.player_tokens (player_id, client_token)
    values (v_player, 'probe-token');

    -- Start the clock last so the elapsed time is as close to the case as possible.
    update public.game_sessions
    set question_started_at = now() - (c.time_taken_ms || ' milliseconds')::interval
    where id = v_session;

    v_result := public.submit_live_answer(
      v_player, 'probe-token', v_session, v_question, c.selected
    );

    v_correct := (v_result->>'isCorrect')::boolean;
    v_points := (v_result->>'pointsAwarded')::int;
    select streak into v_streak from public.players where id = v_player;

    -- The streak lives on the players row and is advanced at reveal, not at
    -- submit, so the RPC must leave it untouched.
    v_slack := case when c.scoring = 'linear' then 2 else 0 end;
    v_ok := v_correct = c.exp_correct
        and abs(v_points - c.exp_points) <= v_slack
        and v_streak = c.prev_streak;

    if v_ok then
      v_pass := v_pass + 1;
      raise notice 'PASS  %', c.name;
    else
      v_fail := v_fail + 1;
      raise notice 'FAIL  % — expected correct=% points=%, got correct=% points=%',
        c.name, c.exp_correct, c.exp_points, v_correct, v_points;
    end if;
  end loop;

  raise notice '---';
  if v_fail = 0 then
    raise notice 'Scoring contract holds: %/% cases passed.', v_pass, v_pass;
  else
    raise notice 'DRIFT: % passed, % FAILED. submit_live_answer and scoring.ts disagree.',
      v_pass, v_fail;
  end if;
end;
$$;

rollback;
