# Qlash

Live classroom quiz for Arabic / church / school rooms. Hosts sign in. Players join with a PIN — no account. Live rooms cap at **80**.

Stack: Next.js 15, React 19, Supabase (Auth, Postgres, Realtime), pnpm, Vitest.

## Local setup

```bash
pnpm install
cp .env.local.example .env.local
```

Fill `.env.local` from the Supabase project settings. Then:

```bash
pnpm dev
```

- Players: [http://localhost:3000](http://localhost:3000) or `/play`
- Hosts: sign in on the landing page → `/dashboard`

```bash
pnpm test
```

## Database

Run these in the Supabase SQL editor, in order, on a new project:

1. `schema.sql`
2. `schema-p0-migration.sql` (if upgrading an older project)
3. `schema-p2-migration.sql`
4. `schema-p2b-capacity.sql`
5. `schema-fast-submit.sql`
6. `schema-p3-live-hardening.sql`
7. `schema-p4-ops.sql` — then confirm with `scripts/verify-rate-limit.sql`
8. `schema-media.sql`
9. `schema-p5-classroom.sql`
10. `schema-p6-locale.sql`
11. `schema-p7-share.sql`
12. `schema-p8-rls.sql` — hide PINs and public quiz dumps; quiz-cap trigger
13. `schema-p9-live.sql` — jump-back score idempotency; drop public session SELECT so hosts cannot list other rooms’ PINs
14. `schema-p10-late-grading.sql` — late-correct answers stay correct (0 points); Postgres stamps `question_started_at`
15. `schema-p11-fast-lobby.sql` — create a live lobby in one Postgres round-trip
16. `schema-p12-hardening.sql` — function grants, session ownership, PIN lifecycle, bucket limits. After p12, new functions get no automatic EXECUTE grant — grant it explicitly.
17. `schema-p13-live-rpcs.sql` — one Postgres-clock update per start, advance, pause, resume, and add-time
18. `schema-p14-realtime-auth.sql` — private realtime topics; Postgres broadcasts session state and kicks
19. `schema-p15-anon-lockdown.sql` — revoke anonymous reads of players and game sessions
20. `schema-p16-keep-history.sql` — deleting a quiz keeps past answers
21. `schema-p17-clock-and-reveal.sql` — projector clock and stale reveal
22. `schema-p18-double-points.sql` — double points follow the question id
23. `schema-p19-question-rules.sql` — gradable question checks
24. `schema-p20-answer-selection.sql` — one poll vote, answers must belong to the question
25. `schema-p21-pause-submit.sql` — a tap during pause stays open
26. `schema-p22-projector-clock.sql` — session `updated_at` uses the database clock
27. `schema-p23-room-lock.sql` — lock joins and remember kicks
28. `schema-p24-import-once.sql` — one import per share code
29. `schema-p25-rate-limit-keys.sql` — hashed rate-limit keys and pruning
30. `schema-p26-stale-rooms.sql` — close quiet rooms and refuse joins after 12 hours

Existing projects that already have the live loop: run **5–30** in that order.

## Security

`schema-p12-hardening.sql` through `schema-p15-anon-lockdown.sql` are steps 16–19 above. Apply them in that order. Realtime: public access must stay disabled.

| Script | When |
|---|---|
| `node scripts/security/check-grants.mjs` | After p12, and again after later SQL. Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_HOST_EMAIL`, `TEST_HOST_PASSWORD`, `FOREIGN_QUIZ_ID`. |
| `node scripts/security/realtime-probe.mjs <sessionId>` | After p14, once while public Realtime is still on and again after it is disabled. Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. |
| `node scripts/scale-realtime.mjs <sessionId> [players=80]` | On the plan production uses, during a real 3-question game. Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. |

Per question, one room of 80 players: `question:start` ≈ 81 events, each state change ≈ 81, answers → host ≤ 80, reveal score updates → host ≈ 80, reactions → host only, ≤ 10/s/room.

## Production URL + Google login

Use a **stable** origin. Do not paste a Vercel `*-vercel.app` deployment-id hostname.

Vercel env (Production):

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_DSN=...
```

After `schema-p4-ops.sql`, run `scripts/verify-rate-limit.sql`. If `consume_rate_limit` is missing, join/submit limits are per Vercel instance only.

Live grading lives in `submit_live_answer`; `src/lib/game/scoring.ts` only mirrors it for the provisional score a phone shows before the reveal. Both are pinned to `src/lib/game/scoringFixture.ts` — CI checks the TypeScript side, and `scripts/verify-scoring.sql` replays the same cases through the real RPC and rolls back. Run it after touching either grader.

Players can add `/play` to the home screen (PWA). Live rooms still need a network.

Supabase **Authentication → URL configuration**:

| Setting | Value |
|---|---|
| Site URL | `https://your-domain.com` |
| Redirect URLs | `https://your-domain.com/auth/callback` |
| Google callback | `https://<project-ref>.supabase.co/auth/v1/callback` |

Enable the Google provider with that Supabase callback in Google Cloud. Local also needs `http://localhost:3000/auth/callback` in Redirect URLs.

## Plans (no Stripe yet)

Set `hosts.plan` in the database when a teacher is blocked:

| Plan | Live seats | Saved quizzes |
|---|---|---|
| `free` (default) | 80 | 5 |
| `pro` | 80 | unlimited |
| `org` | 80 | unlimited |

```sql
update public.hosts set plan = 'pro' where id = '<auth user uuid>';
```

Stripe Checkout comes after someone asks to pay.

## Deploy

Vercel, this repo, env vars above. After deploy, run one real class of 40–80 and fix whatever the room shows you.
