/**
 * Derives everything the dashboard renders from GoHighLevel contacts.
 *
 * There is no history store. Delta and "no movement" need exactly one step
 * back, so the previous lesson count lives in its own field and is shifted
 * forward on each check-in. Nothing in the app looks back further than that.
 * The trade is deliberate: no trend charts without re-adding a store.
 */
import {
  MEMBER_TAG, addNote, addTags, fieldsOf, searchContacts,
  displayName, upsertContact, writeFieldsVerified, type RawContact,
} from "./ghl";
import { DEFAULT_STAGE, MODULES, TOTAL_LESSONS, VISIBLE_MODULES, denominatorFor, moduleForCount } from "./course";
import { RECENT_DAYS } from "./constants";
import type { Checkin, DashboardData, Member, ModuleRow, Progress, Status } from "./types";

export const F = {
  batch: "acg_batch",
  stage: "acg_stage",
  done: "acg_lessons_done",
  prev: "acg_lessons_prev",
  module: "acg_current_module",
  lastCheckin: "acg_last_checkin",
  token: "acg_token",
  blocker: "acg_blocker",
  commitment: "acg_commitment",
  completed: "acg_completed",
} as const;

export const PRIORITY_TAG = "acg:priority";
const num = (v: string | undefined) => (v === undefined || v === "" ? null : Number(v));
const daysBetween = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export type MemberRecord = {
  contactId: string;
  name: string;
  email: string;
  fields: Record<string, string>;
  tags: string[];
};

export async function loadMembers(): Promise<MemberRecord[]> {
  const contacts = await searchContacts(MEMBER_TAG);
  return Promise.all(
    contacts.map(async (c: RawContact) => ({
      contactId: c.id,
      name: displayName(c),
      email: c.email ?? "",
      fields: await fieldsOf(c),
      tags: c.tags ?? [],
    })),
  );
}

export function toProgress(m: MemberRecord): Progress {
  const stage = m.fields[F.stage] || DEFAULT_STAGE;
  const done = num(m.fields[F.done]);
  const prev = num(m.fields[F.prev]);
  const last = m.fields[F.lastCheckin] || "";
  const daysSince = last ? daysBetween(last) : null;
  const delta = done !== null && prev !== null ? done - prev : null;

  let status: Status = "OK";
  if (done === null || !last) status = "No check-in";
  else if (daysSince !== null && daysSince > 10) status = "STALLED";
  else if (delta !== null && delta === 0) status = "NO MOVEMENT";

  const denominator = denominatorFor(stage);
  return {
    name: m.name,
    batch: m.fields[F.batch] || "",
    priority: m.tags.includes(PRIORITY_TAG),
    stage,
    lessonsDone: done,
    denominator,
    percent: done === null ? null : done / denominator,
    currentModule: m.fields[F.module] || (done !== null ? moduleForCount(done) : ""),
    lastCheckin: last || null,
    delta,
    daysSince,
    status,
  };
}

export async function loadDashboard(): Promise<DashboardData> {
  const records = await loadMembers();
  const progress = records.map(toProgress);

  const members: Member[] = records.map((m) => ({
    name: m.name,
    email: m.email,
    batch: m.fields[F.batch] || "",
    stage: m.fields[F.stage] || DEFAULT_STAGE,
    priority: m.tags.includes(PRIORITY_TAG),
    active: true,
    intakeDone: Boolean(m.email),
  }));

  const checkins: Checkin[] = records
    .filter((m) => m.fields[F.lastCheckin])
    .map((m) => ({
      timestamp: m.fields[F.lastCheckin],
      name: m.name,
      lessonsDone: num(m.fields[F.done]),
      currentModule: m.fields[F.module] || "",
      completed: m.fields[F.completed] || "",
      blocker: m.fields[F.blocker] || "",
      commitment: m.fields[F.commitment] || "",
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const modules: ModuleRow[] = MODULES.map((m) => ({
    key: m.key, label: m.label, lessons: m.lessons, visible: m.visible,
  }));

  const scored = progress.filter((p) => p.percent !== null && p.percent > 0);
  const recent = progress.filter((p) => p.daysSince !== null && p.daysSince <= RECENT_DAYS);

  return {
    members, progress, checkins, modules,
    totalLessons: TOTAL_LESSONS,
    kpis: {
      roster: members.length,
      active: members.length,
      priority: members.filter((m) => m.priority).length,
      intakeDone: members.filter((m) => m.intakeDone).length,
      intakeOutstanding: members.filter((m) => !m.intakeDone).length,
      checkedInRecently: recent.length,
      compliance: members.length ? recent.length / members.length : 0,
      avgCompletion: scored.length ? scored.reduce((t, p) => t + (p.percent ?? 0), 0) / scored.length : 0,
      needsAttention: progress.filter((p) => p.status === "STALLED" || p.status === "NO MOVEMENT").length,
      neverCheckedIn: progress.filter((p) => p.status === "No check-in").length,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function rosterNames(): Promise<string[]> {
  return (await loadMembers()).map((m) => m.name).filter(Boolean).sort();
}

export async function memberByToken(token: string): Promise<MemberRecord | null> {
  if (!token) return null;
  const members = await loadMembers();
  return members.find((m) => m.fields[F.token] === token) ?? null;
}

export async function recordIntake(name: string, email: string, batch: string, token: string) {
  const members = await loadMembers();
  const existing = members.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
  if (!existing) return null;

  // Keep an already-issued token: re-registering must not invalidate the link
  // a member has already bookmarked.
  const finalToken = existing.fields[F.token] || token;
  await upsertContact({
    name: existing.name,
    email,
    fields: { [F.batch]: batch, [F.token]: finalToken, [F.stage]: existing.fields[F.stage] || DEFAULT_STAGE },
  });
  await addTags(existing.contactId, [MEMBER_TAG, `acg:batch-${batch.replace(/\D+/g, "") || batch}`]);
  return { contactId: existing.contactId, name: existing.name, token: finalToken };
}

export async function recordCheckin(member: MemberRecord, input: {
  lessonsDone: number; currentModule: string;
  completed?: string; blocker?: string; commitment: string;
}) {
  const previous = member.fields[F.done] ?? "";
  const now = new Date().toISOString();

  // The note goes first and is append-only. If the field writes below drift or
  // silently no-op, this line is how the check-in is still recoverable.
  await addNote(
    member.contactId,
    `${now.slice(0, 10)} check-in · ${input.lessonsDone}/${denominatorFor(member.fields[F.stage] || DEFAULT_STAGE)} · ` +
      `${input.currentModule}${input.blocker ? ` · blocked: ${input.blocker}` : ""}` +
      `${input.commitment ? ` · commits: ${input.commitment}` : ""}`,
  );

  await writeFieldsVerified(member.contactId, member.name, {
    [F.prev]: previous,
    [F.done]: input.lessonsDone,
    [F.module]: input.currentModule,
    [F.lastCheckin]: now,
    [F.completed]: input.completed ?? "",
    [F.blocker]: input.blocker ?? "",
    [F.commitment]: input.commitment,
  });
}

export const MODULE_OPTIONS = VISIBLE_MODULES.map((m) => ({ key: m.key, label: m.label }));
