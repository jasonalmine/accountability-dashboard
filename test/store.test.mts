/** Pure derivation tests. Same scenarios the Postgres version was verified
 *  against, so a regression shows up as a changed number. No network. */
import { toProgress, computeStatus, STATUS_TAG, F, PRIORITY_TAG, type MemberRecord } from "../src/lib/store";
import { moduleForCount, TOTAL_LESSONS } from "../src/lib/course";

let fails = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const member = (name: string, f: Partial<Record<string, string>>, tags: string[] = []): MemberRecord => ({
  contactId: `c_${name}`, name, email: `${name.split(" ")[0].toLowerCase()}@example.com`,
  fields: f as Record<string, string>, tags,
});

console.log("moved forward");
const moved = toProgress(member("Ana Silva", {
  [F.stage]: "In Progress", [F.done]: "42", [F.prev]: "30",
  [F.module]: "MODULE 3", [F.lastCheckin]: daysAgo(1),
}, [PRIORITY_TAG]));
check("lessonsDone", moved.lessonsDone, 42);
check("delta", moved.delta, 12);
check("daysSince", moved.daysSince, 1);
check("status", moved.status, "OK");
check("denominator", moved.denominator, 100);
check("percent 42.0%", (moved.percent! * 100).toFixed(1), "42.0");
check("priority from tag", moved.priority, true);

console.log("\nchecked in but finished nothing");
const stuck = toProgress(member("Dara Nguyen", {
  [F.done]: "20", [F.prev]: "20", [F.module]: "MODULE 2", [F.lastCheckin]: daysAgo(2),
}));
check("delta zero", stuck.delta, 0);
check("status", stuck.status, "NO MOVEMENT");

console.log("\ngone quiet");
const stale = toProgress(member("Chen Wei", {
  [F.done]: "55", [F.prev]: "40", [F.module]: "MODULE 4", [F.lastCheckin]: daysAgo(31),
}));
check("daysSince", stale.daysSince, 31);
check("status beats delta", stale.status, "STALLED");

console.log("\nfirst ever check-in");
const first = toProgress(member("Ben Halloran", {
  [F.done]: "8", [F.module]: "MODULE 1", [F.lastCheckin]: daysAgo(1),
}));
check("delta null with no previous", first.delta, null);
check("status", first.status, "OK");

console.log("\nnever checked in");
const never = toProgress(member("Elena Petrova", { [F.batch]: "Batch 3" }));
check("status", never.status, "No check-in");
check("lessonsDone null", never.lessonsDone, null);
check("percent null", never.percent, null);
check("daysSince null", never.daysSince, null);
check("batch still read", never.batch, "Batch 3");
check("not priority", never.priority, false);

console.log("\nfallbacks");
const noModule = toProgress(member("Rosa Jimenez", { [F.done]: "42", [F.lastCheckin]: daysAgo(1) }));
check("module derived from count when unset", noModule.currentModule, moduleForCount(42));
const unknownStage = toProgress(member("Yuki Tanaka", {
  [F.stage]: "Nonexistent", [F.done]: "50", [F.lastCheckin]: daysAgo(1),
}));
check("unknown stage falls back to total", unknownStage.denominator, TOTAL_LESSONS);

console.log("\nboundary: stalled wins over no-movement");
const both = toProgress(member("Nikolai Volkov", {
  [F.done]: "17", [F.prev]: "17", [F.lastCheckin]: daysAgo(22),
}));
check("status", both.status, "STALLED");

console.log("\nstatus is one definition, shared by dashboard and CRM write");
check("no data", computeStatus(null, null, null), "No check-in");
check("moved", computeStatus(42, 12, 1), "OK");
check("no movement", computeStatus(20, 0, 2), "NO MOVEMENT");
check("stale beats no movement", computeStatus(20, 0, 31), "STALLED");
check("stale beats moved", computeStatus(55, 15, 31), "STALLED");
check("at check-in time only OK or NO MOVEMENT", [computeStatus(42, 12, 0), computeStatus(20, 0, 0)], ["OK", "NO MOVEMENT"]);
check("every status has a distinct tag", new Set(Object.values(STATUS_TAG)).size, 4);

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`}`);
process.exit(fails ? 1 : 0);
