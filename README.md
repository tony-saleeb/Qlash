# Qlash

Live classroom quiz for Arabic / church / school rooms. Hosts sign in. Players join with a PIN — no account. Live rooms cap at **80**.

Stack: Next.js 14, Supabase (Auth, Postgres, Realtime), pnpm, Vitest.

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
7. `schema-p4-ops.sql`
8. `schema-media.sql`
9. `schema-p5-classroom.sql`
10. `schema-p6-locale.sql`
11. `schema-p7-share.sql`

Existing projects that already have the live loop: run **5–11** (re-run fast-submit, then p3, p4, media, p5, p6, p7).

## Production URL + Google login

Use a **stable** origin. Do not paste a Vercel `*-vercel.app` deployment-id hostname.

Vercel env (Production):

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

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
