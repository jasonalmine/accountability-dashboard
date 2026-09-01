/**
 * Runs the production SQL against real Postgres (PGlite, in-process).
 * Fixtures deliberately mirror the ones already hand-verified in the
 * spreadsheet build, so a regression shows up as a changed number.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  PROGRESS_SQL, SESSION_SQL, REMINDER_SQL, MODULES_SQL,
  INSERT_CHECKIN_SQL, UPSERT_INTAKE_SQL, MEMBER_BY_TOKEN_SQL,
} from "../src/lib/sql";

const db = new PGlite();
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${ok ? "" : `  got ${a}, want ${e}`}`);
}

const MEMBERS = [
  ["Ana Beatriz Silva", "Batch 1", true],
  ["Ben Halloran", "Batch 1", true],
  ["Chen Wei", "Batch 1", true],
  ["Dara Nguyen", "Batch 2", true],
  ["Elena Petrova", "Batch 3", false],
] as const;

// [name, days ago, lessons]
const CHECKINS: [string, number, number][] = [
  ["Ana Beatriz Silva", 7, 30],
  ["Ana Beatriz Silva", 1, 42],
  ["Ben Halloran", 1, 8],
  ["Chen Wei", 31, 55],
  ["Dara Nguyen", 2, 20],
  ["Dara Nguyen", 1, 20],
];

async function main() {
  await db.exec(readFileSync("db/schema.sql", "utf8"));
  await db.exec(readFileSync("db/seed.sql", "utf8"));

  for (const [name, batch, priority] of MEMBERS) {
    await db.query(
      `INSERT INTO members (full_name, batch, priority, email, token, intake_at, stage)
       VALUES ($1,$2,$3,$4,$5,now(),(SELECT name FROM stages ORDER BY sort_order LIMIT 1))`,
      [name, batch, priority, `${name.split(" ")[0].toLowerCase()}@example.com`, `tok-${name.split(" ")[0]}`],
    );
  }
  for (const [name, daysAgo, lessons] of CHECKINS) {
    await db.query(
      `INSERT INTO checkins (member_id, stage, lessons_done, current_module, submitted_at, blocker, commitment)
       SELECT id, 'In Progress', $2, $3, now() - make_interval(days => $4::int), 'A2P rejected', 'finish module'
       FROM members WHERE full_name = $1`,
      [name, lessons, lessons > 40 ? "MODULE 4" : "MODULE 2", daysAgo],
    );
  }

  console.log("\nmodule index");
  const mods = (await db.query(MODULES_SQL)).rows as { lessons: number | null; visible_precert: boolean }[];
  check("11 modules seeded", mods.length, 11);
  // The example curriculum totals 100. Swap this if you change db/seed.sql;
  // the sum must equal the denominator your course platform shows members.
  check("visible lessons sum to the denominator",
    mods.filter(m => m.visible_precert).reduce((t, m) => t + (m.lessons ?? 0), 0), 100);
  check("1 module hidden until later", mods.filter(m => !m.visible_precert).length, 1);

  console.log("\nprogress");
  const rows = (await db.query(PROGRESS_SQL)).rows as Record<string, unknown>[];
  const by = (n: string) => rows.find(r => r.full_name === n)!;
  check("5 member rows", rows.length, 5);

  const gil = by("Ana Beatriz Silva");
  check("Ana lessons_done", gil.lessons_done, 42);
  check("Ana delta", gil.delta, 12);
  check("Ana days_since", gil.days_since, 1);
  check("Ana status", gil.status, "OK");
  check("Ana denominator", gil.denominator, 100);
  check("Ana percent 42.0%", ((gil.lessons_done as number) / (gil.denominator as number) * 100).toFixed(1), "42.0");

  const ann = by("Ben Halloran");
  check("Ben delta null on first check-in", ann.delta, null);
  check("Ben status", ann.status, "OK");

  const gle = by("Chen Wei");
  check("Chen days_since", gle.days_since, 31);
  check("Chen status", gle.status, "STALLED");
  check("Chen delta null (single check-in)", gle.delta, null);

  const juv = by("Dara Nguyen");
  check("Dara delta 0", juv.delta, 0);
  check("Dara status", juv.status, "NO MOVEMENT");

  const fritz = by("Elena Petrova");
  check("Elena status", fritz.status, "No check-in");
  check("Elena lessons null", fritz.lessons_done, null);
  check("Elena days_since null", fritz.days_since, null);

  console.log("\nreminders (quiet >= 3 days)");
  const rem = (await db.query(REMINDER_SQL, [3])).rows as { full_name: string }[];
  check("recipients", rem.map(r => r.full_name), ["Chen Wei", "Elena Petrova"]);

  console.log("\nsession view");
  const sess = (await db.query(SESSION_SQL)).rows as { full_name: string; lessons_done: number }[];
  check("one row per member with a check-in", sess.length, 4);
  check("Ana shows latest only", sess.find(s => s.full_name === "Ana Beatriz Silva")!.lessons_done, 42);

  console.log("\nwrites");
  const tok = (await db.query(MEMBER_BY_TOKEN_SQL, ["tok-Ana"])).rows as { full_name: string }[];
  check("token resolves member", tok[0]?.full_name, "Ana Beatriz Silva");
  const bad = (await db.query(MEMBER_BY_TOKEN_SQL, ["nope"])).rows;
  check("bad token resolves nobody", bad.length, 0);

  const intake = (await db.query(UPSERT_INTAKE_SQL,
    ["Elena Petrova", "elena@new.com", "Batch 5", "tok-new"])).rows as { email: string; batch: string; token: string }[];
  check("intake updates email", intake[0].email, "elena@new.com");
  check("intake updates batch", intake[0].batch, "Batch 5");
  check("intake keeps existing token", intake[0].token, "tok-Elena");

  const gilId = (gil.id as number);
  await db.query(INSERT_CHECKIN_SQL, [gilId, "In Progress", 47, "MODULE 5", "did m4", "none", "m5"]);
  const after = (await db.query(PROGRESS_SQL)).rows as Record<string, unknown>[];
  const gil2 = after.find(r => r.full_name === "Ana Beatriz Silva")!;
  check("new check-in becomes latest", gil2.lessons_done, 47);
  check("delta recomputes 47-42", gil2.delta, 5);
  check("status back to OK", gil2.status, "OK");

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
