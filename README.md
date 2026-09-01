# Accountability Dashboard

Progress tracking for community accountability groups working through a shared
course. Members register once and report **one number** before each session.
Facilitators get a view that answers the two questions that actually matter:
**who needs help, and what should we teach next.**

Built for a volunteer study group and generalised so any community can run it.

## The idea

Most cohort trackers die because keeping them current is work. A 100-lesson
course times 30 members is 3,000 checkboxes nobody will ever maintain.

So this tracks **one cumulative number per member per session** — the lesson
count their course platform already computes for them. They read it off their
own screen and paste it in. Nothing to estimate, nothing to tick.

From that single number the dashboard derives everything else: percent complete,
movement since last session, who has gone quiet, and — the useful one — **which
module the cohort is bunched in**. That last chart decides what you teach.

## What facilitators see

- **Where the cohort is bunched** — members per module, busiest highlighted.
  If nine people are stuck in a 20-lesson module, that is this week's session.
- **Needs a nudge** — who is stalled (quiet 10+ days) and who checked in but
  finished nothing. Two different problems needing two different conversations.
- **Every member** — furthest behind first, with movement since last check-in.
- **By batch** — cohort intakes compared.
- **This week's blockers and commitments** — straight from the form, laid out
  to be read aloud during the session.

## What members see

- `/` — register once, get a personal check-in link
- `/checkin/<token>` — the weekly form, no login

The token in the link *is* their credential. No passwords, no accounts, no
"which email did I use". It also closes the hole a name-dropdown form leaves
open, where anyone can submit as anyone.

## Quick start

```bash
git clone https://github.com/<you>/accountability-dashboard
cd accountability-dashboard
npm install

npm run db:dev          # real Postgres via PGlite on :5433, no Docker needed
cp .env.example .env.local
#   DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres
#   DASHBOARD_PASSWORD=<anything>

npm run dev             # http://localhost:3000
npx tsx scripts/seed-demo.ts   # optional: 25 fictional members so it isn't empty
```

`npm test` runs the production SQL against a throwaway Postgres.

## Making it yours

**1. Your curriculum.** Edit `db/seed.sql`. The `lessons` per visible module must
sum to the total your course platform shows members — that total is the
denominator for every percentage. Modules deliberately vary in size; the
bottleneck chart is useful precisely because a 20-lesson module stalls people
and a 4-lesson one does not.

**2. Your roster.** Put one name per line in `db/roster.txt` (gitignored;
`db/roster.example.txt` ships as a sample). Members pick their name at signup,
so only people you list can register.

**3. Your branding.** All optional, all in `.env.local`:

| Variable | Does |
| --- | --- |
| `GROUP_NAME` | Heading on every page |
| `COURSE_NAME` | Shown in the dashboard subtitle |
| `SESSION_SCHEDULE` | Free text, e.g. "Tuesdays 7pm with Ana" |
| `PROGRESS_HINT` | **The important one.** Tell members exactly where to find their number. |
| `PRIORITY_MEMBERS` | Comma-separated names whose attendance is required |

`PROGRESS_HINT` carries more weight than it looks. The whole design rests on
members reading a figure their platform already computed rather than guessing,
so name the exact place: *"the line at the bottom of your course page"*.

## Architecture

Next.js 16 on Vercel, Postgres for storage. That is the whole stack.

Progress is **time-series**, which is the one constraint the design turns on.
"Moved +12 lessons since Tuesday" and "checked in but finished nothing" both
need the *previous* value, so each check-in **appends a row** and is never an
update. Everything else is a window function over that history.

Reminders are deliberately not built in. `N8N_WEBHOOK_URL` receives every intake
and check-in, so you can wire n8n, Zapier, Make, or your own cron to send them
however your community already communicates. If that webhook fails the check-in
still persists — the handoff is logged, never fatal.

## Deploying

Vercel plus any Postgres (Neon's free tier is plenty for a group this size).
Set `DATABASE_URL` to the **pooled** connection string, add `DASHBOARD_PASSWORD`,
then apply `db/schema.sql` and `db/seed.sql`.

Only `/dashboard` is password-gated. The member pages are public by design.

## Honest limitations

- **Self-reported.** Nothing verifies that a member's number is true. The form
  validates the range; it cannot validate honesty. In a group where people
  volunteered to be held accountable, that has been fine.
- **Assumes ordered progress.** A single cumulative count maps to a module only
  if people work through in order. True for gated courses, less so for
  pick-your-own-path ones.
- **One shared facilitator password**, not per-user accounts. Right for a
  handful of facilitators, wrong for an organisation.

## License

MIT.
