/**
 * Derives everything the dashboard renders from GoHighLevel contacts.
 *
 * There is no history store. Delta and "no movement" need exactly one step
 * back, so the previous lesson count lives in its own field and is shifted
 * forward on each check-in. Nothing in the app looks back further than that.
 * The trade is deliberate: no trend charts without re-adding a store.
 */
import {
  MEMBER_TAG, addNote, addTags, createOpportunity, fieldsOf, getContact,
  moveOpportunity, opportunitiesFor, removeTags, searchContacts,
  displayName, updateContact, upsertContact, writeFieldsVerified, type RawContact,
} from "./ghl";
import { isMirroring, pipelineId, stageForCount } from "./pipeline";
import { makeToken, readToken } from "./token";
import { DEFAULT_STAGE, MODULES, PRIORITY_MEMBERS, ROSTER, TOTAL_LESSONS, VISIBLE_MODULES, denominatorFor, moduleForCount } from "./course";
import { RECENT_DAYS } from "./constants";
import type { Checkin, DashboardData, Member, ModuleRow, Progress, Status } from "./types";

/**
 * Custom fields by DISPLAY NAME. GHL derives the storage key from the name with
 * its own slug rules, and a guessed key is accepted with a 200 and discarded,
 * so the name is the contract and the key is resolved from the location.
 * These names must match what provisioning creates.
 */
export const F = {
  batch: "ACG Batch",
  stage: "ACG Stage",
  done: "ACG Lessons Done",
  prev: "ACG Lessons Previous",
  module: "ACG Current Module",
  lastCheckin: "ACG Last Check-in",
  token: "ACG Check-in Token",
  blocker: "ACG Blocker",
  commitment: "ACG Commitment",
  completed: "ACG Completed Since",
  status: "ACG Status",
} as const;

export const PRIORITY_TAG = "acg:priority";

/** One tag per status, so a GHL workflow can trigger on "tag added". Tags are
 *  the reliable trigger surface; a field change fires on any contact edit. */
export const STATUS_TAG: Record<Status, string> = {
  "OK": "acg:status-ok",
  "NO MOVEMENT": "acg:status-no-movement",
  "STALLED": "acg:status-stalled",
  "No check-in": "acg:status-never",
};
const ALL_STATUS_TAGS = Object.values(STATUS_TAG);
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

/** Registered members: contacts in the CRM carrying the member tag. */
export async function loadRegistered(): Promise<MemberRecord[]> {
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

/**
 * The roster, with CRM data merged in where someone has registered. Everyone on
 * the allowlist appears whether or not they signed up, so "intake outstanding"
 * counts the people who still need chasing.
 */
export async function loadMembers(): Promise<MemberRecord[]> {
  const registered = await loadRegistered();
  const byName = new Map(registered.map((m) => [m.name.toLowerCase(), m]));
  // The roster spelling wins: the CRM stores contactName lowercased, which
  // would render "gil fetilo" on the dashboard.
  const merged = ROSTER.map((name) => {
    const found = byName.get(name.toLowerCase());
    return found ? { ...found, name } : { contactId: "", name, email: "", fields: {}, tags: [] };
  });
  // Anyone tagged in the CRM but absent from the allowlist still counts.
  for (const m of registered) {
    if (!ROSTER.some((n) => n.toLowerCase() === m.name.toLowerCase())) merged.push(m);
  }
  return merged;
}

/** Priority comes from config or a CRM tag: an unregistered member has no
 *  contact to carry a tag, so config has to work on its own. */
export function isPriority(m: MemberRecord): boolean {
  return m.tags.includes(PRIORITY_TAG) || PRIORITY_MEMBERS.includes(m.name.toLowerCase());
}

export const STALE_AFTER_DAYS = 10;

/**
 * One definition of status, shared by the dashboard and by what gets written
 * back to the CRM, so a workflow triggering on a tag and a facilitator reading
 * the table can never disagree.
 *
 * STALLED is the exception: it becomes true by time passing, not by anything a
 * member does, so a check-in can only ever produce OK or NO MOVEMENT. Marking
 * someone stalled needs a scheduled sweep.
 */
export function computeStatus(
  done: number | null,
  delta: number | null,
  daysSince: number | null,
): Status {
  if (done === null) return "No check-in";
  if (daysSince !== null && daysSince > STALE_AFTER_DAYS) return "STALLED";
  if (delta !== null && delta === 0) return "NO MOVEMENT";
  return "OK";
}

export function toProgress(m: MemberRecord): Progress {
  const stage = m.fields[F.stage] || DEFAULT_STAGE;
  const done = num(m.fields[F.done]);
  const prev = num(m.fields[F.prev]);
  const last = m.fields[F.lastCheckin] || "";
  const daysSince = last ? daysBetween(last) : null;
  const delta = done !== null && prev !== null ? done - prev : null;
  const status = last ? computeStatus(done, delta, daysSince) : "No check-in";

  const denominator = denominatorFor(stage);
  return {
    name: m.name,
    batch: m.fields[F.batch] || "",
    priority: isPriority(m),
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
    priority: isPriority(m),
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

/** Optional: names expected to register. Used only to count who has not yet
 *  signed up, never to gate registration. */
export function expectedNames(): string[] {
  return [...ROSTER].filter(Boolean);
}

/** Verifies the signature, then reads that one contact by id. No search, so
 *  a link works the instant it is issued. */
export async function memberByToken(token: string): Promise<MemberRecord | null> {
  const contactId = readToken(token);
  if (!contactId) return null;
  const c = await getContact(contactId).catch(() => null);
  if (!c || !(c.tags ?? []).includes(MEMBER_TAG)) return null;
  return {
    contactId: c.id,
    name: displayName(c),
    email: c.email ?? "",
    fields: await fieldsOf(c),
    tags: c.tags ?? [],
  };
}

/**
 * Registration is open to anyone with the link; the link is the gate. Identity
 * is the EMAIL, not the name: upsert dedupes on it, so a misspelled name cannot
 * create a second person, and re-registering updates the same contact.
 */
export async function recordIntake(
  firstName: string,
  lastName: string,
  email: string,
  batch: string,
) {
  const name = `${firstName} ${lastName}`.trim();
  const contact = await upsertContact({
    firstName,
    lastName,
    email,
    fields: { [F.batch]: batch, [F.stage]: DEFAULT_STAGE },
  });
  await addTags(contact.id, [MEMBER_TAG, `acg:batch-${batch.replace(/\D+/g, "") || batch}`]);

  // Derived from the contact id, so re-registering yields the same link and a
  // member's bookmark never breaks.
  const token = makeToken(contact.id);
  await updateContact(contact.id, { [F.token]: token });
  await mirrorStage(contact.id, name, null);
  return { contactId: contact.id, name, token };
}

export async function recordCheckin(member: MemberRecord, input: {
  lessonsDone: number; currentModule: string;
  completed?: string; blocker?: string; commitment: string;
}) {
  const previous = member.fields[F.done] ?? "";
  const now = new Date().toISOString();
  const prevNum = num(previous);
  const delta = prevNum === null ? null : input.lessonsDone - prevNum;
  // A member just checked in, so days-since is 0: this can only be OK or
  // NO MOVEMENT. STALLED is produced by the scheduled sweep, not here.
  const status = computeStatus(input.lessonsDone, delta, 0);

  // The note goes first and is append-only. If the field writes below drift or
  // silently no-op, this line is how the check-in is still recoverable.
  await addNote(
    member.contactId,
    `${now.slice(0, 10)} check-in · ${input.lessonsDone}/${denominatorFor(member.fields[F.stage] || DEFAULT_STAGE)} · ` +
      `${input.currentModule}${input.blocker ? ` · blocked: ${input.blocker}` : ""}` +
      `${input.commitment ? ` · commits: ${input.commitment}` : ""}`,
  );

  await writeFieldsVerified(member.contactId, {
    [F.prev]: previous,
    [F.done]: input.lessonsDone,
    [F.module]: input.currentModule,
    [F.lastCheckin]: now,
    [F.completed]: input.completed ?? "",
    [F.blocker]: input.blocker ?? "",
    [F.commitment]: input.commitment,
    [F.status]: status,
  });
  await applyStatusTag(member.contactId, member.tags, status);
  await mirrorStage(member.contactId, member.name, input.lessonsDone);
  return status;
}

/**
 * Projects a lesson count onto a pipeline stage, so a stage-change workflow can
 * fire on progress. Best-effort by design: a member's check-in is already saved
 * by the time this runs, and losing a board position must never cost a
 * submission. Failures are logged, not thrown.
 */
export async function mirrorStage(contactId: string, name: string, lessons: number | null) {
  if (!isMirroring()) return;
  const stage = stageForCount(lessons);
  if (!stage) return;
  try {
    const pid = pipelineId();
    const existing = await opportunitiesFor(contactId, pid);
    if (existing.length === 0) {
      await createOpportunity({ contactId, pipelineId: pid, stageId: stage.id, name });
      return;
    }
    // Only write when the stage actually changes: a no-op PUT would re-fire
    // every stage-change workflow on every check-in.
    const opp = existing[0];
    if (opp.pipelineStageId !== stage.id) await moveOpportunity(opp.id, stage.id);
  } catch (err) {
    console.error("pipeline mirror failed (check-in is still saved):", err);
  }
}

/**
 * Swaps the status tag. Stale ones are removed first so a workflow triggering
 * on "tag added" fires once for the new state, and a contact never carries two
 * contradictory statuses at the same time.
 */
export async function applyStatusTag(
  contactId: string,
  currentTags: string[],
  status: Status,
): Promise<void> {
  const wanted = STATUS_TAG[status];
  const stale = currentTags.filter((t) => ALL_STATUS_TAGS.includes(t) && t !== wanted);
  if (stale.length) await removeTags(contactId, stale);
  if (!currentTags.includes(wanted)) await addTags(contactId, [wanted]);
}

export const MODULE_OPTIONS = VISIBLE_MODULES.map((m) => ({ key: m.key, label: m.label }));
