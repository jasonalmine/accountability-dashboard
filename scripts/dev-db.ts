/**
 * Local Postgres for development and end-to-end testing, without Docker.
 * PGlite is real Postgres compiled to WASM; pglite-socket puts it on a TCP
 * port so node-postgres connects exactly as it will to Neon.
 *
 *   npx tsx scripts/dev-db.ts
 *   DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres npm run dev
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

const PORT = 5433;
// Members whose attendance the group treats as required. Optional: leave empty
// and every member is tracked equally.
const PRIORITY = new Set(
  (process.env.PRIORITY_MEMBERS || "").split(",").map((s) => s.trim()).filter(Boolean),
);

async function main() {
  const db = await PGlite.create();
  await db.exec(readFileSync("db/schema.sql", "utf8"));
  await db.exec(readFileSync("db/seed.sql", "utf8"));

  // Your real roster goes in db/roster.txt (gitignored). The example ships
  // so a fresh clone has something to run against.
  const rosterFile = existsSync("db/roster.txt") ? "db/roster.txt" : "db/roster.example.txt";
  if (existsSync(rosterFile)) {
  const names = readFileSync(rosterFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const name of names) {
    await db.query(
      `INSERT INTO members (full_name, priority, active, token, stage)
       VALUES ($1, $2, TRUE, $3, (SELECT name FROM stages ORDER BY sort_order LIMIT 1))
       ON CONFLICT (full_name) DO NOTHING`,
      [name, PRIORITY.has(name), randomBytes(16).toString("hex")],
    );
  }
  const { rows } = await db.query<{ c: string }>("SELECT count(*)::text c FROM members");
  console.log(`seeded ${rows[0].c} members`);
  }

  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
  await server.start();
  console.log(`postgres ready on postgres://postgres@127.0.0.1:${PORT}/postgres`);

  for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => { await server.stop(); await db.close(); process.exit(0); });
  }

}

main().catch((e) => { console.error(e); process.exit(1); });
