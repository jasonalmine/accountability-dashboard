-- Progress store.
--
-- Check-ins are APPENDED, never updated. Movement since last session and stall
-- detection both need the previous value, so history is the point: a single
-- current-value column could not answer either question.

CREATE TABLE IF NOT EXISTS stages (
  name         TEXT PRIMARY KEY,
  denominator  INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS batches (
  name       TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS module_index (
  module_key      TEXT PRIMARY KEY,   -- 'START HERE', 'MODULE 0' ...
  module_no       INTEGER,
  label           TEXT NOT NULL,
  lessons         INTEGER,
  phase           TEXT NOT NULL,
  visible_precert BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id              SERIAL PRIMARY KEY,
  ghl_contact_id  TEXT UNIQUE,
  full_name       TEXT NOT NULL UNIQUE,
  email           TEXT,
  batch           TEXT,
  -- No default: stage names are yours to choose in db/seed.sql, so the
  -- application supplies the first stage rather than the schema guessing one.
  stage           TEXT NOT NULL REFERENCES stages(name),
  priority        BOOLEAN NOT NULL DEFAULT FALSE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  token           TEXT UNIQUE,        -- signed link identity, no login
  intake_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS checkins (
  id             SERIAL PRIMARY KEY,
  member_id      INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  stage          TEXT,
  lessons_done   INTEGER NOT NULL CHECK (lessons_done >= 0 AND lessons_done <= 200),
  current_module TEXT REFERENCES module_index(module_key),
  completed      TEXT,
  blocker        TEXT,
  commitment     TEXT,
  -- set once the row has been handed off to your automation platform;
  -- NULL means it still needs sending, so a failed handoff is recoverable
  synced_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS checkins_member_time ON checkins (member_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS checkins_unsynced ON checkins (synced_at) WHERE synced_at IS NULL;
