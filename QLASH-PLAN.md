# Qlash — summary plan

> **Status board:** the Cursor growth review canvas
> (`qlash-growth-review.canvas.tsx`) is the order of work. This file is
> strategy background. Do not treat the tables below as current status —
> reports, RTL, image upload, CI lint/test/build, Arabic first paint,
> share cards (`/q`, `/p`, WhatsApp), player PWA, and Sentry have
> shipped. Next is seasonal packs, paste-from-chat, and a demo PIN.

Qlash is already a **real live quiz**, not a mock. Hosts auth, players join with a PIN, scoring is a Postgres RPC, rooms cap at **80**, and the Qlash stage is distinctive.

You will not beat Kahoot by copying Kahoot. You make money by owning one job Kahoot does badly: **Arabic / church / classroom rooms that just work on school Wi‑Fi**.

---

## What you actually have

| Layer | Status |
|---|---|
| Live loop (lobby → question → reveal → podium) | Working |
| PIN join, reconnect, kick, pause, 2x, teams | Working |
| Scoring in the database (`submit_live_answer`) | The source of truth — good |
| Editor + CSV + Arabic template | Working |
| Tests (~150) | Solid for the engine |
| Post-game reports / history | **Missing** — this is why teachers do not come back |
| Image upload, RTL, Stripe, CI, real rate limits | **Missing** |
| README / package name still `kahoot` | Still looks like a prototype |

The dangerous bits if you skip them: rate limits are **in-memory** (useless across Vercel instances), and 300 players is a different product. Stay at 80 until reports exist.

---

## How to master it

Learn these four files until you can explain them out loud:

1. `schema.sql` + `schema-fast-submit.sql` — tables, RLS, the submit RPC
2. `src/app/host/[sessionId]/HostGameClient.tsx` — host is the clock
3. `src/app/play/[sessionId]/PlayerGameClient.tsx` — phones never trust the host’s UI
4. `src/lib/game/scoring.ts` — JS copy of the SQL math; keep them in sync

Draw the session statuses on paper:

`lobby` → `question_active` → `question_paused` → `question_reveal` → `leaderboard` → `finished`

Every bug lives on those transitions.

Then run **one real class of 30–80**. That session teaches more than a month of new question types.

---

## What “super special” means

Not neon UI. Not AI that writes 1,000 questions. Special is:

- **Arabic-first live rooms** — RTL editor + player screens, the church / general-knowledge bank as a first-class library
- **Teacher afterglow** — after the podium, a report: who missed what, CSV, replay in one tap
- **Phone-proof** — join in 8 seconds on bad Wi‑Fi, sound that actually plays, reconnect when a kid locks the screen
- **Projector as a product** — host screen is the lesson, phones are buttons. Keep that split sacred

Kahoot is English, generic, and expensive for small schools. Qlash can be “the quiz the Sunday school / Arabic class actually finishes.”

---

## How money shows up

Anyone who signs up can already host. That is the right foundation. Do **not** add Stripe this month.

When a teacher asks for more, charge **the host**, never the player:

| Plan | Seats | Quizzes | Price shape |
|---|---|---|---|
| Free | 30 live | 5 saved | Get them hooked |
| Pro | 80 live | unlimited | Monthly, for teachers |
| Org | several hosts | shared library + reports | Church / school |

Add `hosts.plan` in the data model; enforce the numbers in `MAX_PLAYERS_PER_SESSION` and quiz create. Stripe is a weekend once someone is blocked by the cap.

Do not chase ads, player accounts, or a public “TikTok of quizzes” until 20 hosts have run 3 games each.

---

## Order that levels the product up

### 1. Close the classroom loop (this is the product)

Session report + replay + image upload + RTL. Without this, Qlash is a fun night, not a tool.

### 2. Look like a company

Rename package to `qlash`, write a real README, GitHub Action for `pnpm test`, production `NEXT_PUBLIC_SITE_URL`, Google OAuth on the live domain. Teachers will not pay a site that still says kahoot.

### 3. Survive a real room

One 40–80 player game. Fix whatever breaks. Then move rate limits off in-memory (Redis or a Supabase table).

### 4. Gate, then charge

`free` / `pro` on `hosts`. Stripe Checkout. That’s the business.

### 5. Only then grow

Share-by-link quizzes, Arabic content packs (paid), maybe Google Classroom. Growth without (1)–(3) is churn.

---

## Do not do these

- 300-player rooms, AI question mills, custom themes, a mobile native app
- Player logins (PIN-only is a feature)
- Building Stripe before a teacher has asked to pay

---

## First build

Master the live loop, make the **report the second half of the game**, own Arabic classrooms. That is how this becomes special enough to sell.

The single move that most changes whether Qlash feels finished: **the report page after the podium**.

---

## Codebase snapshot (repo facts)

Keep this when you sit down to build. The live product is complete; the business layer is not.

**Already wired**
- Surfaces: `/` landing, `/play` join, `/dashboard` library, `/dashboard/quizzes/[id]/edit`, `/host/[sessionId]`, `/play/[sessionId]`, `/auth/callback`
- Host actions: start, pause/resume, +10s, 2×, reveal, leaderboard, podium, kick, live edit, announcement
- Player: PIN + token in `localStorage`, reconnect, hydrate if a broadcast is missed
- Engine: `scoring.ts`, `clock.ts`, `shuffle.ts`, `teams.ts`, `marks.ts`, `joinClient.ts`
- DB: `hosts`, `quizzes`, `questions`, `game_sessions`, `players`, `player_tokens`, `answers_submitted`
- RPCs: `submit_live_answer` (player submit), `apply_question_scores_and_reveal` (host reveal)
- Cap: `MAX_PLAYERS_PER_SESSION = 80`. Join 120/IP/min, submit 400/IP/min, 8/player/min
- Scoring details: +1500ms late grace, linear decay to 50% of base at timeout, streak bonus `min(250, (streak-1)*50)`, leaderboard top 5

**Debt to clean while you ship reports (do not expand scope)**
- Package name and README still say `kahoot` / create-next-app
- Join UI duplicated on `/` and `/play`
- Scoring exists twice (TypeScript + SQL) — they can drift
- Theme / cover_image columns exist; live rooms ignore them on purpose
- Question images are URL paste only — no Storage upload
- Token keys still named `quizarena_token_*`
- Rate limiter is in-memory (wrong on multi-instance Vercel)
- No `.github` CI, no Stripe, no reports UI, no RTL (`html lang="en"`)
- `getSession()` in game actions vs `getUser()` in quiz actions — pick one (prefer `getUser`)

**Do not “fix” these unless they bite**
- PIN-only players (that is the product)
- Hard 80 cap (raise only after reports + a real 80-player session)
- Host/player as large clients — split later, not before the report page
