# Qlash

Live classroom quiz for Arabic / church / school rooms. Hosts sign in. Players join with a PIN — no account. Cap is **80** on Pro, **30** on Free.

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

Existing projects that already have the live loop: run **5–8** (re-run fast-submit, then p3, p4, media).

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
| `free` (default) | 30 | 5 |
| `pro` | 80 | unlimited |
| `org` | 80 | unlimited |

```sql
update public.hosts set plan = 'pro' where id = '<auth user uuid>';
```

Stripe Checkout comes after someone asks to pay.

## Deploy

Vercel, this repo, env vars above. After deploy, run one real class of 40–80 on Pro (or 30 on Free) and fix whatever the room shows you.
