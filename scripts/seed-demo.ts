/** Fills a local database with a believable cohort so you can see the dashboard
 *  populated before any real member signs up. Intake goes through the real API;
 *  check-ins are inserted with backdated timestamps, because the time-based
 *  states (STALLED, NO MOVEMENT) need history the API cannot fabricate. */
import { Client } from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/postgres";

// cumulative lesson count -> module key, matching db/seed.sql
const BANDS: [number, string][] = [
  [3, "START"], [11, "MODULE 1"], [31, "MODULE 2"], [43, "MODULE 3"], [61, "MODULE 4"],
  [70, "MODULE 5"], [75, "MODULE 6"], [85, "MODULE 7"], [91, "MODULE 8"], [100, "MODULE 9"],
];
const moduleFor = (n: number) => BANDS.find(([c]) => n <= c)?.[1] ?? "MODULE 9";

type M = { name: string; batch: string; checkins: [number, number][]; blocker?: string; commitment?: string };

// [daysAgo, lessonsDone] — a cohort roughly four weeks in
const COHORT: M[] = [
  { name: "Ana Beatriz Silva", batch: "Batch 1", checkins: [[16, 10], [9, 24], [2, 38]], blocker: "Stuck on the module 2 exercises", commitment: "Finish module 2" },
  { name: "Ben Halloran", batch: "Batch 1", checkins: [[15, 4], [8, 12], [1, 19]], blocker: "Fell behind after travel", commitment: "Two lessons a day" },
  { name: "Chen Wei", batch: "Batch 1", checkins: [[31, 48]], blocker: "Swamped at work", commitment: "Block two hours Saturday" },
  { name: "Dara Nguyen", batch: "Batch 2", checkins: [[9, 18], [2, 18]], blocker: "Keep rewatching instead of building", commitment: "Actually build the exercise" },
  { name: "Elena Petrova", batch: "Batch 2", checkins: [[14, 42], [7, 55], [1, 63]], commitment: "Get through module 5" },
  { name: "Farid Haddad", batch: "Batch 1", checkins: [[12, 15], [3, 29]], blocker: "Environment setup problems", commitment: "Finish setup, start module 3" },
  { name: "Grace Mensah", batch: "Batch 2", checkins: [[11, 14], [4, 26]], commitment: "Module 2 done by Thursday" },
  { name: "Hana Kobayashi", batch: "Batch 1", checkins: [[8, 27], [2, 27]], blocker: "Honestly did not make time", commitment: "One hour every weekday" },
  { name: "Ibrahim Toure", batch: "Batch 3", checkins: [[13, 39], [6, 50], [1, 57]], commitment: "Finish the build module" },
  { name: "Ines Ferreira", batch: "Batch 2", checkins: [[10, 6], [3, 13]], blocker: "Still choosing a project", commitment: "Pick a project and commit" },
  { name: "Jonas Lindqvist", batch: "Batch 3", checkins: [[14, 64], [7, 78], [1, 86]], commitment: "Start the final project" },
  { name: "Kavya Raman", batch: "Batch 1", checkins: [[18, 24]], blocker: "Laptop in repair", commitment: "Back on it once it returns" },
  { name: "Leilani Kahale", batch: "Batch 2", checkins: [[12, 22], [5, 34], [1, 41]], blocker: "Data module is dense", commitment: "Rewatch module 3, then move on" },
  { name: "Marco Bellini", batch: "Batch 3", checkins: [[9, 36], [2, 47]], commitment: "Finish module 4" },
  { name: "Mira Sundqvist", batch: "Batch 1", checkins: [[11, 20], [4, 32]], blocker: "Automation module is overwhelming", commitment: "Build one small automation" },
  { name: "Nadia Rahman", batch: "Batch 2", checkins: [[10, 28], [3, 36]], commitment: "Reach module 5" },
  { name: "Nikolai Volkov", batch: "Batch 3", checkins: [[22, 17]], blocker: "Family emergency", commitment: "Restart next week" },
  { name: "Omar Salazar", batch: "Batch 1", checkins: [[13, 70], [6, 83], [1, 91]], commitment: "Finish and present" },
  { name: "Priya Deshmukh", batch: "Batch 2", checkins: [[8, 21], [2, 30]], commitment: "Module 3 this week" },
  { name: "Rafael Santos", batch: "Batch 3", checkins: [[7, 8], [1, 14]], commitment: "Finish foundations" },
  { name: "Rosa Jimenez", batch: "Batch 1", checkins: [[6, 3], [1, 9]], blocker: "Just joined, catching up", commitment: "Module 1 by Thursday" },
  { name: "Samuel Adeyemi", batch: "Batch 2", checkins: [[9, 16], [2, 23]], commitment: "Core concepts done" },
  { name: "Sofia Kowalski", batch: "Batch 3", checkins: [[12, 52], [5, 61], [1, 68]], commitment: "Templates module" },
  { name: "Tariq Aziz", batch: "Batch 2", checkins: [[11, 31], [4, 31]], blocker: "Blocked on the same exercise all week", commitment: "Ask for help in session" },
  { name: "Yuki Tanaka", batch: "Batch 3", checkins: [[13, 75], [6, 88], [2, 95]], commitment: "Final project" },
];

async function main() {
  // Phase 1: intake through the real API, holding NO database connection.
  let intakes = 0;
  for (const m of COHORT) {
    const res = await fetch(`${BASE}/api/intake`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: m.name,
        email: `${m.name.split(" ")[0].toLowerCase()}@example.com`,
        batch: m.batch,
      }),
    });
    if (!res.ok) { console.error("intake failed", m.name, await res.text()); continue; }
    intakes++;
  }

  // Phase 2: backdated check-ins. The API always stamps now().
  const db = new Client({ connectionString: DB, ssl: false });
  await db.connect();
  let checkins = 0;
  try {
    for (const m of COHORT) {
      const { rows } = await db.query("SELECT id, stage FROM members WHERE full_name = $1", [m.name]);
      if (!rows.length) continue;
      const { id, stage } = rows[0];
      const lastDay = m.checkins[m.checkins.length - 1][0];
      for (const [daysAgo, lessons] of m.checkins) {
        const last = daysAgo === lastDay;
        await db.query(
          `INSERT INTO checkins (member_id, submitted_at, stage, lessons_done, current_module, completed, blocker, commitment)
           VALUES ($1, now() - make_interval(days => $2::int), $3, $4, $5, $6, $7, $8)`,
          [id, daysAgo, stage, lessons, moduleFor(lessons),
           `Worked through ${moduleFor(lessons)}`,
           last ? (m.blocker ?? null) : null,
           last ? (m.commitment ?? null) : null]);
        checkins++;
      }
    }
  } finally {
    await db.end();
  }
  console.log(`seeded ${intakes} intakes, ${checkins} check-ins across ${COHORT.length} members`);
}
main().catch((e) => { console.error(e); process.exit(1); });
