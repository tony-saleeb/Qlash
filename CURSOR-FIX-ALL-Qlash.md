# Qlash — Cursor Fix-All Prompts

**Target commit:** `34b929b` · **Re-audited:** 14 Sep 2026
**Already fixed by you, don't redo:** public PIN exposure (`schema-p8-rls.sql`), open redirect (`safeNextPath`), room capacity race (`schema-p3-live-hardening.sql`), PIN generation entropy (`livePin.ts`).

**How to use:** each task is one Cursor composer session. Paste the **Master Context** once at the top, then the task prompt. Do not start the next task until the gate passes.

---

## 📌 Master Context — paste at the top of every session

> You are working on Qlash, a live multiplayer quiz app (Kahoot-style). Next.js 14 App Router + Supabase (Postgres, RLS, Realtime broadcast). ~80 players per room on classroom Wi-Fi.
>
> **Ground rules for every task:**
>
> 1. **Never edit `schema.sql` or an existing `schema-*.sql` file to change behaviour.** Those are a historical record of migrations already applied to live Supabase projects. Write a NEW numbered migration file (`schema-p10-*.sql`, `schema-p11-*.sql`, …). The one exception is mirroring the final state into `schema.sql` at the END of a task so a fresh project bootstraps correctly — do that as a separate, clearly-labelled edit.
> 2. **Do not change what an existing test asserts.** If a fix requires changing an assertion, stop and tell me — an assertion that resists a fix may be encoding a real bug.
> 3. **No `any`, no `as unknown as`, no `@ts-ignore`, no `@ts-expect-error`.**
> 4. **Do not refactor anything outside the task's scope.** Every diff should be readable as "this fix and nothing else."
> 5. `src/lib/game/scoring.ts` is a TypeScript mirror of the Postgres grader used for unit tests. If you change grading logic in SQL, change it there too and re-run `src/lib/game/scoringContract.test.ts`.
> 6. Run `npx vitest run` before you tell me you're done. 363 tests currently pass; that number may only go up.

---

# 🔴 TASK 1 — The last-second answer bug

**This is the live bug. Do it first.** Correct answers submitted near the buzzer are displayed as wrong, and in one path are written to the database as wrong permanently.

**@-context:**
`@schema-fast-submit.sql` `@schema-p9-live.sql` `@src/lib/game/constants.ts` `@src/app/host/[sessionId]/HostGameClient.tsx` `@src/app/play/[sessionId]/PlayerGameClient.tsx` `@src/lib/game/clock.ts` `@src/app/api/player/current-question/route.ts` `@src/app/api/player/round-result/route.ts` `@src/app/actions/game.ts` `@src/lib/game/scoring.ts`

> **Prompt**
>
> Players report: "I picked the correct answer in the last seconds and it showed as wrong." I traced it. There are three independent mechanisms and they stack. Fix all five items below in one pass — they interlock and fixing only some will leave the bug present.
>
> **Root cause in one sentence:** the host reveals the round at exactly the same moment the server stops accepting answers (both are 1500 ms), so every answer still in flight when the buzzer goes is a coin flip — and when it loses, the system reports "wrong" rather than "too late."
>
> ---
>
> **1.1 — Stop grading late answers as incorrect.**
>
> `schema-fast-submit.sql` lines 120–121:
>
> ```sql
> if v_is_late then
>   v_is_correct := false;
> ```
>
> This conflates "too slow to score" with "got it wrong." It is also redundant — line 159 already gates the points correctly with `if v_is_correct and not v_is_late then`. So these two lines do nothing except write a false value into `answers_submitted.is_correct` for an answer that was actually right.
>
> Write migration `schema-p10-late-grading.sql` that recreates `submit_live_answer` with the late branch removed from the grading section, so `v_is_correct` always reflects the truth. Keep the points gate at line 159 exactly as it is — late answers must still score 0.
>
> In the same migration, add a `was_late boolean not null default false` column to `answers_submitted`, and store `v_is_late` in it on insert. Return `'wasLate', v_is_late` in the function's JSON result too.
>
> **1.2 — Don't let a late-correct answer extend a streak.**
>
> `schema-p9-live.sql` line 98 currently reads:
>
> ```sql
> streak = case when s.is_correct is true then p.streak + 1 else 0 end
> ```
>
> After 1.1, `is_correct` will be true for late answers that were right, so this would grant a streak for a zero-point answer. Change it to key off points instead:
>
> ```sql
> streak = case when s.is_correct is true and coalesce(s.points_awarded, 0) > 0 then p.streak + 1 else 0 end
> ```
>
> Include the recreated `apply_question_scores_and_reveal` in `schema-p10-late-grading.sql`. Add the `points_awarded` column to the inner `select` in the `from (...)` subquery — it is not currently selected there, so this will not compile without that change. Check it.
>
> **1.3 — Separate the two grace windows.**
>
> `src/lib/game/constants.ts:8` has `SUBMIT_LATE_GRACE_MS = 1500`, and `schema-fast-submit.sql:107` has the server's late cutoff at `v_time_limit_ms + 1500`. `HostGameClient.tsx:540` uses the same constant for the host's reveal delay.
>
> These being equal is the core design flaw: the host closes the round at the same instant the server stops accepting, so any answer in flight is lost. The host must reveal **after** the server has stopped accepting, never at the same moment.
>
> - Keep the server's cutoff at `+1500 ms`. Rename the existing constant to `SERVER_LATE_CUTOFF_MS = 1500` so its meaning is unambiguous.
> - Add `HOST_REVEAL_DELAY_MS = 2700` and use that in `HostGameClient.tsx:540`. That is the server cutoff plus ~1200 ms of network headroom.
> - Add a comment above both constants stating: *these two values must never be equal; `HOST_REVEAL_DELAY_MS` must always exceed `SERVER_LATE_CUTOFF_MS` by at least the worst expected player round-trip, or in-flight answers are lost.*
> - Update `src/lib/game/constants.test.ts` (it currently asserts `SUBMIT_LATE_GRACE_MS === 1500`) and `src/lib/game/scoringContract.test.ts` to use the renamed constant. Add a new test asserting `HOST_REVEAL_DELAY_MS > SERVER_LATE_CUTOFF_MS`.
> - Also account for the host's 200 ms `setInterval` tick in `HostGameClient.tsx:548` — the `remaining <= 0` detection can be up to 200 ms late on its own. Note this in the comment.
>
> **1.4 — Stop erasing the player's answer when the submit fails.**
>
> `PlayerGameClient.tsx:858–862`:
>
> ```ts
> } catch (err: unknown) {
>   console.error(err);
>   lastSubmitRef.current = null;
>   setSubmissionState('idle');
>   toast.error(err instanceof Error ? err.message : t('submitFailed'));
> }
> ```
>
> Setting `lastSubmitRef.current = null` is what makes the failure invisible. At reveal, `applyRevealInstant` (line ~439) sees no submission, falls through to `let isCorrect = false` at line 448, and shows "Missed" with the wrong-answer sound. The player is never told their answer was rejected.
>
> Change it to:
> - Keep `lastSubmitRef.current` with its selection intact; add an `error: string | null` field to the ref's shape (declared around line 113).
> - Retry the request **once** after 400 ms before giving up. Use `keepalive: true` as the existing call does.
> - If the server returns 403 with the `SUBMISSIONS_CLOSED` message, do not show a generic failure. Add a new i18n key `timesUp` and show that instead — the player needs to know it was a timing issue, not a wrong answer.
> - Update `applyRevealInstant` so that when `lastSubmitRef.current.error` is set, the reveal card shows the "time's up" state rather than the "missed" state, and does **not** play `playIncorrectSound()`.
>
> **1.5 — Fix the clock so the displayed timer matches the server.**
>
> Three separate problems, all in play:
>
> - `clock.ts:11` uses `Math.ceil`, so the display reads "1" when the real remaining time is anywhere from 1 ms to 1000 ms. A player tapping at "1" may have 40 ms left.
> - `clock.ts:5` defaults `now` to the **phone's** `Date.now()` and compares it against a server-issued timestamp. There is no clock-offset handshake anywhere in the codebase — I checked. A phone whose clock is 2 s slow shows "3, 2, 1" after the server has already closed the round.
> - `game.ts:268` sets `question_started_at` from `new Date().toISOString()` — the **Node/Vercel process clock** — while the grader computes elapsed time from Postgres `now()`. Two different machines' clocks in one comparison.
>
> Fix all three:
>
> - Add `server_now: new Date().toISOString()` to the response in `current-question/route.ts` (alongside `server_started_at` at line 113).
> - In `PlayerGameClient.tsx`, compute `serverClockOffsetMs = Date.parse(server_now) - Date.now()` on the first hydrate and store it in a ref. Pass `Date.now() + offset` as the `now` argument to every `remainingSeconds` call. Do not re-measure on every response — a single measurement at hydrate is enough and re-measuring makes the countdown jitter.
> - Change the display to `Math.floor` and add a sub-second visual cue, so "1" means at least a full second remains.
> - In `PlayerGameClient.tsx:813`, `submitAnswer` has no deadline guard: `if (!player || !activeQuestion || submissionState !== 'idle') return;`. Add a check — if offset-corrected remaining time is `<= 0`, do not send the request; show the `timesUp` toast instead. A silent wrong answer is the worst possible outcome here.
> - Change `game.ts:268` to get the start timestamp from Postgres rather than Node. Add a small RPC `public.start_question_clock(p_session_id uuid, ...)` that sets `question_started_at = now()` server-side and returns it, or have the existing update return `now()` — either is fine, but the anchor and the grader must read the same clock.
>
> **1.6 — Make "no submission" distinguishable from "wrong."**
>
> `round-result/route.ts:63` returns `submission: submission || { points_awarded: 0, is_correct: false }` when no row exists. That makes a rejected submit indistinguishable from a wrong answer on the client. Add an explicit `submitted: boolean` field to the response and have `PlayerGameClient` render the "time's up" state when `submitted === false` but the player did tap an answer.

**Gate**

```bash
npx vitest run 2>&1 | tail -3
```
→ ≥ 363 tests pass, including the new `HOST_REVEAL_DELAY_MS > SERVER_LATE_CUTOFF_MS` assertion

```bash
grep -n "v_is_correct := false" schema-p10-late-grading.sql
```
→ appears only in the `poll` branch, never under `if v_is_late`

```bash
grep -n "SUBMIT_LATE_GRACE_MS" src/ -r
```
→ no output (fully renamed)

**SQL gate** — run in the Supabase SQL editor after applying the migration:

```sql
-- a late-but-correct answer must be recorded correct, worth 0, and flagged late
select is_correct, points_awarded, was_late
from answers_submitted
order by created_at desc limit 5;
```
→ rows with `was_late = true` show `is_correct = true` where the answer was right, and `points_awarded = 0`

**Manual gate — this is the one that proves it.** Open the player on a phone, and throttle its network in DevTools to "Slow 3G" (or use a real phone on congested Wi-Fi). Answer **correctly** with the timer showing 1 second. Then check all four:

1. The player's screen shows either "Correct +0" or "Time's up" — never "Missed" with the wrong-answer sound
2. `select is_correct from answers_submitted ...` shows `true`
3. The player's streak is not reset
4. Repeat 10 times. Zero occurrences of a correct answer displayed as wrong.

---

# 🟠 TASK 2 — Remove the answer oracle

**@-context:** `@src/app/api/submit-answer/route.ts` `@src/app/play/[sessionId]/PlayerGameClient.tsx` `@src/app/api/submit-answer/route.test.ts` `@src/app/api/player/round-result/route.ts`

**Do this after Task 1**, because Task 1 changes how `lastSubmitRef` is populated and the two would conflict.

> **Prompt**
>
> `src/app/api/submit-answer/route.ts` lines 106–107 return `pointsAwarded` and `isCorrect` in the 200 response while the question is still live:
>
> ```ts
> pointsAwarded: result?.pointsAwarded ?? 0,
> isCorrect: Boolean(result?.isCorrect),
> ```
>
> The player UI does not display these until the reveal — it stores them in `lastSubmitRef` and waits. So the disclosure buys nothing and enables a working cheat:
>
> ```
> 1. Join the same room 3 extra times  (joinPerIp allows 240/minute)
> 2. Each fake player submits a different option and reads isCorrect from the reply
> 3. The real account submits the confirmed answer
> ```
>
> `submitPerPlayer: 20/min` does not stop this because each fake player submits exactly once. A 4-option question falls to certainty with 3 fake players.
>
> **Changes:**
>
> - Return exactly `{ success, duplicate, message }` from the route. Remove both fields — do not gate them on session status, remove them.
> - In `PlayerGameClient.tsx` around line 847–853, the client currently sets `isCorrect` from the response. Change it so correctness comes only from `syncOfficialScore` / `/api/player/round-result`, which is already correctly gated on `status ∈ {question_reveal, leaderboard, finished}`.
> - Check the reveal path still works: `applyRevealInstant` has a `submit.isCorrect === null` branch at line 434 that waits, and a retry loop around line 641. Confirm both still resolve. If the player can briefly see a locally-guessed result that later flips when the server answers, show a neutral "checking…" state instead.
> - Update `src/app/api/submit-answer/route.test.ts` to assert the response body has no `isCorrect` and no `pointsAwarded` key. Add a regression test that fails if either reappears.

**Gate**

```bash
grep -n "isCorrect\|pointsAwarded" src/app/api/submit-answer/route.ts
```
→ appears only in the RPC result type, never inside `NextResponse.json`

**Manual:** two browser profiles, one answers right and one wrong. During the live round, inspect both `submit-answer` responses in DevTools → Network. Neither body contains a correctness signal. At reveal both still show the correct result and score.

---

# 🟠 TASK 3 — Lock the realtime channel

**@-context:** `@src/hooks/useSessionChannel.ts` `@src/hooks/useSessionChannel.test.tsx` `@src/app/host/[sessionId]/HostGameClient.tsx` `@src/app/play/[sessionId]/PlayerGameClient.tsx` `@schema-p8-rls.sql` `@schema-p9-live.sql`

> **Prompt**
>
> `src/hooks/useSessionChannel.ts:40` opens a Supabase Realtime broadcast channel with no authorization:
>
> ```ts
> const channel = client.channel(`session_channel_${sessionId}`, {
> ```
>
> There is no `private: true`, and no RLS policy on `realtime.messages` in any migration file. Supabase's docs are explicit that without Realtime Authorization, any client can subscribe to a public channel and **send** on it as well as receive. The anon key ships in the JavaScript bundle, so it is public.
>
> The player client treats every broadcast as if it came from the host. An anonymous attacker can spoof `question:start` (fake question and answers), `question:reveal` (with attacker-chosen `correct_answer_ids`), `timer:sync` (end the round early), `host:announcement` (arbitrary text on all 80 screens), and `multiplier:change`.
>
> **Part A — migration `schema-p11-realtime-auth.sql`:**
>
> Add RLS policies on `realtime.messages` scoped by `realtime.topic()`. The access model is deliberately asymmetric:
>
> - **Players (`anon`): SELECT only.** They must receive but never send.
> - **The session's host (`authenticated`, matching `game_sessions.host_id`): SELECT and INSERT.** Not every authenticated user — the host of session A must not be able to broadcast into session B.
>
> Starting point, which you must verify against the current Supabase Realtime Authorization docs before applying — check the exact `realtime.topic()` signature and whether RLS needs enabling on `realtime.messages` explicitly:
>
> ```sql
> create policy "session members can receive broadcasts"
>   on realtime.messages for select to anon, authenticated
>   using (
>     realtime.messages.extension = 'broadcast'
>     and exists (
>       select 1 from public.game_sessions gs
>       where 'session_channel_' || gs.id::text = realtime.topic()
>     )
>   );
>
> create policy "only the session host can broadcast"
>   on realtime.messages for insert to authenticated
>   with check (
>     realtime.messages.extension = 'broadcast'
>     and exists (
>       select 1 from public.game_sessions gs
>       where 'session_channel_' || gs.id::text = realtime.topic()
>         and gs.host_id = (select auth.uid())
>     )
>   );
> ```
>
> **Part B — client:** add `private: true` to the channel config in `useSessionChannel.ts:40`. Both host and player go through this hook, so it is one line.
>
> The hook's `send` retries on failure. Under private channels a permission denial is permanent, not transient — distinguish a permission error from a transport error and surface the permission case to the caller instead of burning retries.
>
> **Part C — verify the postgres_changes subscriptions survive.** `PlayerGameClient.tsx` also subscribes to `postgres_changes` on `game_sessions` (UPDATE) and `players` (DELETE, for kick detection). Postgres Changes respects RLS and the column grants already in `schema-p8-rls.sql`. **Test empirically, do not assume**, that both still deliver events to an anon client. Report what you observe.
>
> If either stops delivering, do **not** widen the grants. Move that signal onto the now-authenticated broadcast channel instead — the host already calls `sendSessionEvent` on every state transition, so add the missing field to those payloads.
>
> **Part D — do this last, after A–C are verified working:** in the Supabase Dashboard → Realtime → Settings, disable **"Allow public access."** Until that is off, public channels still work and the fix is not enforced. Doing it before Part B ships would disconnect every player mid-game.

**Gate 1 — the attack must fail.** Throwaway script, anon key only, against a live session:

```js
// scripts/verify-broadcast-lockdown.mjs — delete after use, do not commit
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const ch = s.channel(`session_channel_${process.argv[2]}`, { config: { private: true } });
ch.subscribe(async (status, err) => {
  console.log('subscribe:', status, err?.message ?? '');
  if (status === 'SUBSCRIBED') {
    const r = await ch.send({ type: 'broadcast', event: 'question:reveal',
      payload: { correct_answer_ids: ['1'], option_counts: {} } });
    console.log('send result:', r);   // must NOT be 'ok'
  }
});
```

**Gate 2 — the gate that actually closes this.** Run that script on a loop attempting a spoofed reveal every 2 seconds, while playing a real round on a second device. The player's screen shows only the genuine host's reveal, at the genuine time, with the genuine answer. Nothing from the attacker appears.

**Gate 3:** `npx vitest run src/hooks/useSessionChannel.test.tsx` — update the test to assert `private: true` is in the channel config.

---

# 🟡 TASK 4 — Quick correctness batch

Six independent small fixes. One session, but **commit each separately**.

**@-context:** `@src/app/api/player/me/route.ts` `@src/app/api/player/join/route.ts` `@next.config.mjs` `@schema.sql` `@tailwind.config.ts` `@src/lib/game/marks.ts` `@src/app/actions/game.ts`

> **Prompt**
>
> Six unrelated fixes. Do them in order, commit separately.
>
> **4.1 — A database update that never runs.** `src/app/api/player/me/route.ts:57`:
>
> ```ts
> void admin.from('players').update({ connected: true }).eq('id', player.id);
> ```
>
> Supabase query builders are lazy — the HTTP request is only issued inside `.then()`. `void` evaluates the expression without calling `.then()`, so this update **never reaches the database**. Confirmed against `@supabase/postgrest-js@2.110.1`, where the fetch fires inside `then()`. The response then returns `connected: true` anyway, so the player's screen looks right while the host's lobby still shows them offline.
>
> `await` it and check the error. If the update fails, still return the player — reconnect should not hard-fail on a presence flag — but `console.error` it. Then grep all of `src/` for any other `void <client>.from(` or `void <client>.rpc(` and fix each the same way. Add a test asserting the mock's `update` was actually invoked on a successful reconnect; the current tests pass without it ever being called, which is why this shipped.
>
> **4.2 — "Bob" and "bob" are different players.** `src/app/api/player/join/route.ts:88` uses `.eq('nickname', trimmedNickname)` — case-sensitive. The database's unique index is on `lower(nickname)`. A student who joined as "Bob", lost connection, and rejoins typing "bob" is told the game has already started and is locked out of their own score. Match case-insensitively at every nickname lookup in this file, the way the index already does.
>
> **4.3 — No security headers.** `next.config.mjs` still has none. Add `poweredByHeader: false` and an async `headers()` for `/(.*)` with: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`.
>
> Add CSP as **`Content-Security-Policy-Report-Only` first**, not enforced — this app opens a Supabase WebSocket and loads Google Fonts, and a wrong `connect-src` silently kills gameplay mid-round:
>
> ```
> default-src 'self'; script-src 'self' 'unsafe-inline';
> style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
> font-src 'self' https://fonts.gstatic.com data:;
> img-src 'self' data: blob: https:;
> connect-src 'self' https://*.supabase.co wss://*.supabase.co;
> frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
> ```
>
> Comment why `'unsafe-inline'` is needed (Next 14 inlines the RSC flight payload; removing it requires a middleware nonce) and that this must be promoted to enforced once a full game produces zero console violations.
>
> **4.4 — Unlocked privileged function.** `handle_new_user()` in `schema.sql` is `SECURITY DEFINER` with no `set search_path`. It runs as the definer on every signup. The other privileged functions in this codebase all pin it; this one was missed, and Supabase's linter flags it as `function_search_path_mutable`. Write migration `schema-p12-search-path.sql` recreating it with `set search_path = ''` — empty, not `public`. With an empty search_path everything non-builtin must be schema-qualified; `public.hosts` already is, and `coalesce`/`split_part` are `pg_catalog` builtins. Verify that by applying it and inserting a test user, don't assume. Use `create or replace` so the `on_auth_user_created` trigger keeps pointing at it.
>
> **4.5 — Tailwind can't see part of the codebase.** `tailwind.config.ts:4–8` scans `./src/pages/**` (which does not exist) and omits `./src/lib/**` and `./src/hooks/**`. `src/lib/game/marks.ts` returns the class names `text-arena-ink`, `text-arena-acid`, and `text-white` — they survive purging today only because components happen to use them independently. The next class added there vanishes in production. Remove the dead `pages` glob, add `lib` and `hooks`.
>
> **4.6 — PIN pool degrades forever.** `schema.sql:52` still declares `pin text unique not null` — globally unique including finished games. Your `livePin.ts` + 8-retry loop masks this well, but the pool shrinks permanently and retries grow. Write migration `schema-p13-pin-lifecycle.sql` that: finds the real constraint name from `pg_constraint` (do not guess it), drops it, drops the redundant non-unique `game_sessions_pin_idx` (it duplicates the index the unique constraint already created), and creates `create unique index game_sessions_pin_live_uidx on public.game_sessions (pin) where status <> 'finished';`. Before dropping anything, check for existing duplicate live PINs and report the count — if any exist, stop rather than letting the index creation fail halfway. Keep the retry loop; it is still correct.

**Gate**

```bash
grep -rn "void .*\.from(\|void .*\.rpc(" src/          # → no output
grep -n "src/pages" tailwind.config.ts                 # → no output
grep -n "poweredByHeader\|Content-Security" next.config.mjs  # → both present
npx vitest run 2>&1 | tail -3                          # → all pass
```

```bash
npx next build && (npx next start -p 3111 &) && sleep 12
curl -sS -D - -o /dev/null http://127.0.0.1:3111/ | grep -iE "strict-transport|x-frame|content-security|x-powered-by"
```
→ headers present, **no** `X-Powered-By` line

```sql
select indexname from pg_indexes where tablename='game_sessions' and indexdef ilike '%pin%';
```
→ exactly one row, the partial unique index

**Manual:** sign up with a fresh Google account (4.4), and reconnect with a differently-cased nickname mid-game (4.2).

---

# 🟡 TASK 5 — Make CI catch this class of bug

**@-context:** `@.github/workflows/test.yml` `@package.json` `@src/test/supabaseMock.ts` `@src/app/api/player/join/route.test.ts` `@src/app/api/submit-answer/route.test.ts` `@src/lib/supabase/hostAuth.test.ts` `@src/app/api/player/room/route.test.ts` `@src/app/api/player/roster/route.test.ts` `@src/lib/supabase/client.test.ts`

> **Prompt**
>
> `npx tsc --noEmit` currently exits 1 with **16 errors**, all in test files. `next build` does not surface them, and `.github/workflows/test.yml` runs tests but has no typecheck step — so CI is green while the type checker is red. That count has grown from 7 to 16 since the last audit, which is what happens when nothing enforces it.
>
> **Part A — fix the 16 errors.** The root cause is over-narrow types in `src/test/supabaseMock.ts`, not bugs in the tests:
>
> - `TS2556 A spread argument must have a tuple type` — a `...args` spread into a function with fixed parameters. Type the spread source as a tuple, or call with explicit positional arguments.
> - `TS2322 Type 'false' is not assignable to type 'true'` — TypeScript inferred a literal `true` from an object literal. Widen the declared field type to `boolean`.
> - `TS2741 Property 'email' is missing` (`hostAuth.test.ts:27`) — the mock user type requires `email`. Make it optional, or supply it in the fixture.
>
> No `any`, no `@ts-ignore`. Do not change what any test asserts.
>
> **Part B — enforce it.** Add `"typecheck": "tsc --noEmit"` to `package.json` scripts. Add a `typecheck` step to `.github/workflows/test.yml` that runs before the test step, so the job fails on a type error.
>
> **Part C — add the regression test that would have caught the live bug.** Write `src/lib/game/timing.test.ts` asserting:
>
> 1. `HOST_REVEAL_DELAY_MS > SERVER_LATE_CUTOFF_MS` — with a comment explaining that equal values lose every in-flight answer
> 2. The margin is at least 1000 ms
> 3. A correct answer arriving at `timeLimit + SERVER_LATE_CUTOFF_MS - 1` grades as `isCorrect: true` with points > 0
> 4. A correct answer arriving at `timeLimit + SERVER_LATE_CUTOFF_MS + 1` grades as `isCorrect: true` with points === 0 — **not** `isCorrect: false`
>
> Item 4 is the assertion that encodes the actual bug. Use `src/lib/game/scoring.ts`, the TypeScript mirror of the Postgres grader, and make sure `scoringContract.test.ts` still pins the two together.

**Gate**

```bash
npx tsc --noEmit; echo "exit=$?"     # → exit=0, no output
npm run typecheck                     # → exits 0
npx vitest run 2>&1 | tail -3         # → all pass including timing.test.ts
```

**Manual:** open a PR with a deliberate type error and confirm CI goes red.

---

# 🔴 TASK 6 — Upgrade off Next.js 14

**Do this LAST.** It rewrites every page file and will hide regressions from Tasks 1–5 behind migration churn. But do it **the same week** — the current dependency state includes two unauthenticated remote-code-execution advisories.

**@-context:** `@package.json` `@src/lib/supabase/server.ts` `@src/middleware.ts` `@src/app/dashboard/page.tsx` `@src/app/host/[sessionId]/page.tsx` `@src/app/play/[sessionId]/page.tsx` `@src/app/dashboard/quizzes/[id]/edit/page.tsx` `@src/app/auth/callback/route.ts` `@next.config.mjs` `@src/app/actions/game.ts` `@src/app/actions/quizzes.ts`

**Measured at HEAD:** `pnpm audit` → **2 critical, 22 high, 16 moderate, 2 low.** 23 of those are against `next`.

```
CVE-2026-75604       CRITICAL  Unauthenticated RCE, Windows-hosted servers   patched >=15.5.24
GHSA-2xp9-vwfh-vxw4  CRITICAL  Unauthenticated RCE in Image Optimization     patched >=15.5.24
CVE-2026-64641       HIGH      DoS in App Router via Server Actions          patched >=15.5.21
CVE-2026-64649       HIGH      SSRF in Server Actions                        patched >=15.5.21
CVE-2026-44578       HIGH      SSRF via WebSocket upgrade                    patched >=15.5.16
CVE-2026-44573       HIGH      Middleware / proxy bypass                     patched >=15.5.16
```

The Windows RCE does not apply on Vercel/Linux. **The Image Optimization one needs checking** — confirm whether `/_next/image` is reachable on your deployment before deciding how urgent this is.

> **Prompt**
>
> This project pins `next@14.2.35` — the final release of a line that receives no further security patches. `pnpm audit` reports 2 critical and 22 high advisories, none of which have a 14.x fix. Upgrade to the current 15.5.x Maintenance LTS.
>
> Run `npm view next dist-tags` and `npm view next versions --json` first to find the current 15.5.x patch. Do not guess a version number — the fix for the critical advisories requires ≥ 15.5.24.
>
> **Breaking changes this codebase will hit. Handle each explicitly:**
>
> 1. **`cookies()` is async.** `src/lib/supabase/server.ts` calls it synchronously. `createClient` must become `async`, and every call site must `await`. Call sites: all page components, `src/app/auth/callback/route.ts`, `src/app/actions/game.ts`, `src/app/actions/quizzes.ts`, `src/lib/supabase/hostAuth.ts`, `src/lib/supabase/hostSession.ts`.
> 2. **`params` is a Promise.** `host/[sessionId]/page.tsx`, `play/[sessionId]/page.tsx`, and `dashboard/quizzes/[id]/edit/page.tsx` destructure it synchronously. Change the prop type to `Promise<{...}>` and `await params`.
> 3. **Default caching changed.** Verify every page that currently sets `export const dynamic = 'force-dynamic'` still has it after the codemod.
> 4. **ESLint.** `eslint-config-next` moves to a matching major and may require flat config. If `next lint` is deprecated in the target version, migrate to `eslint` directly and update the `lint` script and the CI workflow.
>
> Run `npx @next/codemod@latest upgrade` first, then fix what it misses by hand. Codemods reliably miss the Supabase `createClient` wrapper, because the `cookies()` call sits one level of indirection away from the page.
>
> Also address the non-`next` advisories in the same pass: `postcss`, `nanoid`, `brace-expansion`, `js-yaml`, `glob`, `vitest`, `@vitest/mocker`. Most should resolve with a lockfile refresh.
>
> Change nothing else. No refactors, no unrelated bumps, no style changes. This diff must read as "the migration and nothing else."

**Gate**

```bash
pnpm audit 2>&1 | tail -5
```
→ `0 critical`, `0 high`

```bash
npx tsc --noEmit && npm run typecheck && npx next build
```
→ all exit 0; route table still lists every page and API route

```bash
npx vitest run 2>&1 | tail -3
```
→ test count unchanged from before the upgrade

**Manual — full regression, both roles.** Google sign-in → dashboard → create from template → edit and save → start a game → PIN and QR render → player joins on a second device → three questions with reveal → leaderboard → podium with correct rank.

**Then re-run Task 1's throttled manual gate and Task 3's attack script.** Both must still hold after the migration. A passing build is not evidence that the live behaviour survived.

---

## Order summary

| # | Task | Why this position |
|:--|:--|:--|
| **1** | The last-second answer bug | Live, user-visible, corrupts stored data |
| **2** | Remove answer oracle | Touches the same `lastSubmitRef` code as Task 1 |
| **3** | Lock realtime channel | Independent; the remaining critical |
| **4** | Quick correctness batch | Six independent small fixes |
| **5** | CI + typecheck gate | Guards everything above from regressing |
| **6** | Next.js 15 upgrade | Rewrites every page — do last, but this week |

**One-day version:** Task 1 alone. It's the bug you're actually hitting and the only one writing wrong data to disk.
