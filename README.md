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
cp .env.example .env.local   # add GHL_PIT, GHL_LOCATION_ID, DASHBOARD_PASSWORD
npm run dev                  # http://localhost:3000
```

`npm test` runs the derivation logic with no network and no database.

There is **no database to run**. Your CRM already stores contacts; this reads
and writes those.

## Making it yours

**1. Your curriculum.** Edit `src/lib/course.ts`. The `lessons` across visible
modules must sum to the total your course platform shows members — that total is
the denominator for every percentage. Modules deliberately vary in size; the
bottleneck chart is useful precisely because a 20-lesson module stalls people
and a 4-lesson one does not.

**2. Your roster.** Set `ROSTER` to the names allowed to register, comma- or
newline-separated. Members pick their name at signup, so only people on that
list can register, and a CRM contact is created when they do.

The roster is config rather than CRM data for a concrete reason: the CRM will
not accept a contact without an email or phone, and members have neither until
they register. Everyone on the list shows on the dashboard whether or not they
have signed up, which is what makes "intake outstanding" meaningful.

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

Next.js 16 on Vercel. GoHighLevel is the store. There is no database.

The design turns on one observation: **nothing here looks back further than one
step.** "Moved +12 lessons" and "checked in but finished nothing" both need the
*previous* value and nothing older. So the previous count lives in its own
field, shifted forward on each check-in. A history table would be storing
unbounded rows to answer a one-step question.

The trade is deliberate and worth knowing: trend charts and per-batch curves
over time are impossible without re-adding a store.

Every check-in also writes an append-only **note** on the contact. That is the
recovery path — this API has failure modes that return `200` and persist
nothing, and the note survives them.

Reminders are deliberately not built in. `N8N_WEBHOOK_URL` receives every intake
and check-in, so you can wire n8n, Zapier, Make, or your own cron to send them
however your community already communicates. If that webhook fails the check-in
still persists — the handoff is logged, never fatal.

## Deploying

Vercel. Set `GHL_PIT`, `GHL_LOCATION_ID`, and `DASHBOARD_PASSWORD`. No database
to provision.

Before first use, create these custom fields on the location: `acg_batch`,
`acg_stage`, `acg_lessons_done`, `acg_lessons_prev`, `acg_current_module`,
`acg_last_checkin`, `acg_token`, `acg_blocker`, `acg_commitment`,
`acg_completed`. The app refuses to write to a field that does not exist rather
than accepting the silent no-op the API would otherwise give you.

Only `/dashboard` is password-gated. The member pages are public by design.

## Honest limitations

- **Self-reported.** Nothing verifies that a member's number is true. The form
  validates the range; it cannot validate honesty. In a group where people
  volunteered to be held accountable, that has been fine.
- **Assumes ordered progress.** A single cumulative count maps to a module only
  if people work through in order. True for gated courses, less so for
  pick-your-own-path ones.
- **One step of history.** Delta and stall detection work; trends do not.
- **One shared facilitator password**, not per-user accounts. Right for a
  handful of facilitators, wrong for an organisation.

## License

MIT.
