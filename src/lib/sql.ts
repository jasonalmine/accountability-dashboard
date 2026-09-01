/**
 * SQL kept in one place so the PGlite tests exercise exactly the statements
 * that run in production. Percent is derived in TypeScript from lessons_done
 * and the stage's denominator, never a hardcoded 114 (modules 10 and 11 are
 * hidden until certification, so the denominator moves).
 */

export const PROGRESS_SQL = `
WITH ranked AS (
  SELECT
    c.member_id,
    c.submitted_at,
    c.lessons_done,
    c.current_module,
    c.stage,
    ROW_NUMBER() OVER (PARTITION BY c.member_id ORDER BY c.submitted_at DESC) AS rn,
    LAG(c.lessons_done) OVER (PARTITION BY c.member_id ORDER BY c.submitted_at) AS prev_lessons
  FROM checkins c
),
latest AS (SELECT * FROM ranked WHERE rn = 1)
SELECT
  m.id,
  m.full_name,
  m.email,
  m.batch,
  m.priority,
  m.active,
  m.intake_at IS NOT NULL                          AS intake_done,
  COALESCE(l.stage, m.stage)                       AS stage,
  s.denominator                                    AS denominator,
  l.lessons_done                                   AS lessons_done,
  l.current_module                                 AS current_module,
  l.submitted_at                                   AS last_checkin,
  (l.lessons_done - l.prev_lessons)                AS delta,
  CASE WHEN l.submitted_at IS NULL THEN NULL
       ELSE FLOOR(EXTRACT(EPOCH FROM (now() - l.submitted_at)) / 86400)::int
  END                                              AS days_since,
  CASE
    WHEN l.lessons_done IS NULL                                       THEN 'No check-in'
    WHEN now() - l.submitted_at > INTERVAL '10 days'                  THEN 'STALLED'
    WHEN l.prev_lessons IS NOT NULL
         AND l.lessons_done - l.prev_lessons = 0                      THEN 'NO MOVEMENT'
    ELSE 'OK'
  END                                              AS status
FROM members m
LEFT JOIN latest l ON l.member_id = m.id
LEFT JOIN stages s ON s.name = COALESCE(l.stage, m.stage)
ORDER BY m.full_name
`;

/** Latest submission per member, for the in-session blockers list. */
export const SESSION_SQL = `
SELECT DISTINCT ON (c.member_id)
  m.full_name, c.submitted_at, c.lessons_done, c.current_module,
  c.completed, c.blocker, c.commitment
FROM checkins c
JOIN members m ON m.id = c.member_id
ORDER BY c.member_id, c.submitted_at DESC
`;

export const MODULES_SQL = `
SELECT module_key, module_no, label, lessons, phase, visible_precert
FROM module_index ORDER BY sort_order
`;

/** Reminder recipients: active, has an email, and quiet for N days (or never). */
export const REMINDER_SQL = `
WITH last AS (
  SELECT member_id, MAX(submitted_at) AS last_at FROM checkins GROUP BY member_id
)
SELECT m.id, m.full_name, m.email, m.token, l.last_at
FROM members m
LEFT JOIN last l ON l.member_id = m.id
WHERE m.active
  AND m.email IS NOT NULL
  AND (l.last_at IS NULL OR now() - l.last_at >= make_interval(days => $1::int))
ORDER BY m.full_name
`;

export const INSERT_CHECKIN_SQL = `
INSERT INTO checkins (member_id, stage, lessons_done, current_module, completed, blocker, commitment)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, submitted_at
`;

export const UPSERT_INTAKE_SQL = `
UPDATE members
   SET email = $2, batch = $3, intake_at = COALESCE(intake_at, now()), token = COALESCE(token, $4)
 WHERE full_name = $1
RETURNING id, full_name, email, batch, token
`;

export const MEMBER_BY_TOKEN_SQL = `
SELECT id, full_name, stage, batch FROM members WHERE token = $1 AND active
`;

/** Roster + batch options for the intake page. */
export const ROSTER_SQL = `
SELECT full_name, intake_at IS NOT NULL AS intake_done
FROM members WHERE active ORDER BY full_name
`;

export const BATCHES_SQL = `SELECT name FROM batches ORDER BY sort_order`;

/** Module picker options, visible modules only. */
export const MODULE_OPTIONS_SQL = `
SELECT module_key, label FROM module_index
WHERE visible_precert ORDER BY sort_order
`;
