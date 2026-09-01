/**
 * Your curriculum. This replaces what used to be a database table, because a
 * course outline changes a few times a year, not a few times an hour.
 *
 * Two rules the app depends on:
 *   1. `lessons` across visible modules must sum to the total your course
 *      platform shows members. That total is the denominator for every percent.
 *   2. Order is the order members work through. Progress is one cumulative
 *      lesson count, so order decides which module a given count falls in.
 */
export type Module = {
  /** Must match exactly what members pick in the check-in form. */
  key: string;
  label: string;
  /** null for content that has not unlocked yet. */
  lessons: number | null;
  /** false hides it from the picker and excludes it from the denominator. */
  visible: boolean;
};

export const MODULES: Module[] = [
  { key: "START",     label: "Start Here",                     lessons: 3,    visible: true },
  { key: "MODULE 1",  label: "Module 1: Foundations",          lessons: 8,    visible: true },
  { key: "MODULE 2",  label: "Module 2: Core Concepts",        lessons: 20,   visible: true },
  { key: "MODULE 3",  label: "Module 3: Working with Data",    lessons: 12,   visible: true },
  { key: "MODULE 4",  label: "Module 4: Building Things",      lessons: 18,   visible: true },
  { key: "MODULE 5",  label: "Module 5: Templates and Assets", lessons: 9,    visible: true },
  { key: "MODULE 6",  label: "Module 6: Tracking Progress",    lessons: 5,    visible: true },
  { key: "MODULE 7",  label: "Module 7: Automation",           lessons: 10,   visible: true },
  { key: "MODULE 8",  label: "Module 8: Reporting",            lessons: 6,    visible: true },
  { key: "MODULE 9",  label: "Module 9: Putting It Together",  lessons: 9,    visible: true },
  { key: "MODULE 10", label: "Module 10: Advanced (locked)",   lessons: null, visible: false },
];

/**
 * Stages let the denominator grow when later content unlocks. If your course
 * never unlocks more, give every stage the same number.
 */
export const STAGES: { name: string; denominator: number }[] = [
  { name: "In Progress", denominator: 100 },
  { name: "Completed",   denominator: 100 },
  { name: "Advanced",    denominator: 100 },
];

export const VISIBLE_MODULES = MODULES.filter((m) => m.visible);
export const TOTAL_LESSONS = VISIBLE_MODULES.reduce((t, m) => t + (m.lessons ?? 0), 0);
export const DEFAULT_STAGE = STAGES[0].name;

export function denominatorFor(stage: string): number {
  return STAGES.find((s) => s.name === stage)?.denominator ?? TOTAL_LESSONS;
}

/**
 * Which module a cumulative lesson count falls inside.
 * Strictly less-than: landing exactly on a module's cumulative total means you
 * finished it, so you are in the next one, not still in that one.
 */
export function moduleForCount(count: number): string {
  let seen = 0;
  for (const m of VISIBLE_MODULES) {
    seen += m.lessons ?? 0;
    if (count < seen) return m.key;
  }
  return VISIBLE_MODULES[VISIBLE_MODULES.length - 1]?.key ?? "";
}

/** Modules fully finished at a cumulative count, assuming ordered progress. */
export function modulesCompleted(count: number): string[] {
  const done: string[] = [];
  let seen = 0;
  for (const m of VISIBLE_MODULES) {
    seen += m.lessons ?? 0;
    if (seen <= count) done.push(m.key);
    else break;
  }
  return done;
}

/** Batch / cohort options offered at sign-up. Edit to match your intakes. */
export const BATCHES: string[] =
  (process.env.BATCHES || "Batch 1,Batch 2,Batch 3,Batch 4,Batch 5,Batch 6")
    .split(",").map((b) => b.trim()).filter(Boolean);
