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

- `/` — register once with first name, last name, email and cohort
- `/checkin/<token>` — the weekly form, no login

The token in the link *is* their credential. No passwords, no accounts, no
"which email did I use". It also closes the hole a name-dropdown form leaves
open, where anyone can submit as anyone.

The token is the contact's id, HMAC-signed with `TOKEN_SECRET`. That is not
decoration: a random token stored on the contact would have to be found by
searching every contact, and that search index lags writes by seconds, so a
member who registers and immediately clicks their own link would be told it is
invalid. Signing the id means verify, then fetch that one contact.

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

**1. Your curriculum.** Edit `src/lib/course.ts`, or set `COURSE_MODULES` and
`COURSE_STAGES` to JSON arrays if you would rather configure than fork. The `lessons` across visible
modules must sum to the total your course platform shows members — that total is
the denominator for every percentage. Modules deliberately vary in size; the
bottleneck chart is useful precisely because a 20-lesson module stalls people
and a 4-lesson one does not.

**2. Your roster (optional).** `ROSTER` lists the names you *expect* to
register. It is not a gate: anyone with the link can sign up. It exists so the
dashboard can show who has not registered yet. Leave it empty and you simply
see everyone who has.

Identity is the **email**, not the name. The CRM dedupes on it, so a misspelled
name cannot create a second person and re-registering updates the same contact.
The trade-off is that someone who types a spelling different from your `ROSTER`
entry appears as an extra row until you reconcile it.

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

Before first use, create these custom fields on the location, **by these exact
names**: `ACG Batch`, `ACG Stage`, `ACG Lessons Done`, `ACG Lessons Previous`,
`ACG Current Module`, `ACG Last Check-in`, `ACG Check-in Token`, `ACG Blocker`,
`ACG Commitment`, `ACG Completed Since`.

Names, not keys. GoHighLevel derives the storage key from the name with its own
slug rules — "ACG Check-in Token" becomes `acg_checkin_token`, "ACG Lessons
Previous" becomes `acg_lessons_previous` — so the app resolves the real key from
the location instead of guessing. A guessed key is accepted with a `200` and
silently discarded. The app refuses to write to a field it cannot resolve.

Only `/dashboard` is password-gated. The member pages are public by design.

## Mirroring progress to a pipeline (optional)

Set `PIPELINE_ID`, `PIPELINE_STAGES` and `PIPELINE_BANDS` and each check-in
projects the member's lesson count onto a pipeline stage. The point is not
reporting: a stage change is a first-class workflow trigger, so crossing into a
stage can start a sequence without this app knowing that sequence exists.

Two deliberate choices. The stage is only written when it actually changes, or
a no-op update would re-fire every stage-change workflow on every check-in. And
mirroring is best-effort: the check-in is already saved by the time it runs, so
a failure is logged rather than thrown. Losing a board position must never cost
a submission.

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
