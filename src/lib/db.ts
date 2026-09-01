import { Client, Pool } from "pg";
import { RECENT_DAYS } from "./constants";
import { MODULES_SQL, PROGRESS_SQL, SESSION_SQL } from "./sql";
import type { Checkin, DashboardData, Member, ModuleRow, Progress, Status } from "./types";

type Row = Record<string, unknown>;
export type Query = (sql: string, params?: unknown[]) => Promise<Row[]>;

/**
 * Standard node-postgres rather than the Neon HTTP driver: Neon speaks plain
 * Postgres, and this way the same code runs against a local instance, so the
 * flow can actually be tested end to end instead of only in production.
 * Use Neon's *pooled* connection string on serverless.
 */
let pool: Pool | undefined;
let localChain: Promise<Row[]> = Promise.resolve([]);

const DEAD_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "57P01", "08006", "08003"]);

/** pg reports a server-side disconnect as a bare message with no code, so match both. */
function isDeadConnection(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code && DEAD_CODES.has(err.code)) return true;
  return /Connection terminated|Client has encountered a connection error|server closed the connection/i
    .test(err?.message ?? "");
}

export function dbQuery(): Query {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL env var is not set");
  const local = /localhost|127\.0\.0\.1/.test(connectionString);

  // Local dev runs against a PGlite socket server, which serves a single
  // connection and closes it eagerly. Pooling against that is pointless and
  // flaky, so open and close a client per query. Production pools.
  if (local) {
    return (text, params = []) => {
      // Serialized: the socket server accepts one connection at a time, and the
      // pages legitimately fire queries with Promise.all. Production runs them
      // concurrently against the pool; only the dev harness needs the queue.
      const result = localChain.then(async () => {
        const client = new Client({ connectionString, ssl: false });
        await client.connect();
        try {
          return (await client.query(text, params)).rows as Row[];
        } finally {
          await client.end().catch(() => {});
        }
      });
      // The tail must never hold a rejection: chaining onto a rejected promise
      // propagates it forever, so one failed query would poison every query
      // that follows for the life of the process.
      localChain = result.then(() => [], () => []);
      return result;
    };
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: { rejectUnauthorized: true },
    });
    // Without this listener pg escalates an idle-client error to an uncaught
    // exception and takes the server down.
    pool.on("error", (err) => console.error("pg idle client error:", err.message));
  }

  return async (text, params = []) => {
    try {
      return (await pool!.query(text, params)).rows as Row[];
    } catch (err) {
      // Serverless Postgres recycles idle connections and an admin restart sends
      // 57P01, so a pooled socket can be dead on arrival. Retry once, then give up.
      if (!isDeadConnection(err)) throw err;
      console.warn("pg connection was dead, retrying once");
      return (await pool!.query(text, params)).rows as Row[];
    }
  };
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Shapes the three queries into the payload the page renders. */
export async function loadDashboard(q: Query): Promise<DashboardData> {
  const [progressRows, sessionRows, moduleRows] = await Promise.all([
    q(PROGRESS_SQL),
    q(SESSION_SQL),
    q(MODULES_SQL),
  ]);

  const progress: Progress[] = progressRows.map((r) => {
    const lessons = n(r.lessons_done);
    const denominator = n(r.denominator) ?? 114;
    return {
      name: s(r.full_name),
      batch: s(r.batch),
      priority: Boolean(r.priority),
      stage: s(r.stage),
      lessonsDone: lessons,
      denominator,
      percent: lessons === null ? null : lessons / denominator,
      currentModule: s(r.current_module),
      lastCheckin: iso(r.last_checkin),
      delta: n(r.delta),
      daysSince: n(r.days_since),
      status: (s(r.status) || "No check-in") as Status,
    };
  });

  const members: Member[] = progressRows.map((r) => ({
    name: s(r.full_name),
    email: s(r.email),
    batch: s(r.batch),
    stage: s(r.stage),
    priority: Boolean(r.priority),
    active: Boolean(r.active),
    intakeDone: Boolean(r.intake_done),
  }));

  const checkins: Checkin[] = sessionRows.map((r) => ({
    timestamp: iso(r.submitted_at) ?? "",
    name: s(r.full_name),
    lessonsDone: n(r.lessons_done),
    currentModule: s(r.current_module),
    completed: s(r.completed),
    blocker: s(r.blocker),
    commitment: s(r.commitment),
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const modules: ModuleRow[] = moduleRows.map((r) => ({
    key: s(r.module_key),
    label: s(r.label),
    lessons: n(r.lessons),
    visible: Boolean(r.visible_precert),
  }));

  const active = members.filter((m) => m.active);
  const scored = progress.filter((p) => p.percent !== null && p.percent > 0);
  const recent = progress.filter((p) => p.daysSince !== null && p.daysSince <= RECENT_DAYS);

  return {
    members, progress, checkins, modules,
    totalLessons: modules.filter((m) => m.visible).reduce((t, m) => t + (m.lessons ?? 0), 0),
    kpis: {
      roster: members.length,
      active: active.length,
      priority: members.filter((m) => m.priority).length,
      intakeDone: members.filter((m) => m.intakeDone).length,
      intakeOutstanding: members.filter((m) => m.active && !m.intakeDone).length,
      checkedInRecently: recent.length,
      compliance: active.length ? recent.length / active.length : 0,
      avgCompletion: scored.length ? scored.reduce((t, p) => t + (p.percent ?? 0), 0) / scored.length : 0,
      needsAttention: progress.filter((p) => p.status === "STALLED" || p.status === "NO MOVEMENT").length,
      neverCheckedIn: progress.filter((p) => p.status === "No check-in").length,
    },
    generatedAt: new Date().toISOString(),
  };
}
