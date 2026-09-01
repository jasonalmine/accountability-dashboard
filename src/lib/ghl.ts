/**
 * GoHighLevel as the store. Documented API only, on a location Private
 * Integration Token.
 *
 * Three failure modes here return HTTP 200 and persist nothing, so every one
 * has a guard rather than a comment:
 *   - PUT /contacts/{id} with {tags:[...]}  -> use POST /contacts/{id}/tags
 *   - a custom field written by its full "contact.x" key instead of the short key
 *   - a write to a field that does not exist in the location
 * Reads return the full key ("contact.acg_batch"); writes must use the short
 * one ("acg_batch"). That asymmetry is the trap.
 */
const BASE = "https://services.leadconnectorhq.com";

// Cloudflare answers default Node/Python clients with 1010 (a 403 that reads
// exactly like an auth failure). A browser User-Agent is mandatory.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class GhlError extends Error {}

export type RawContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  contactName?: string;
  email?: string;
  tags?: string[];
  customFields?: { id: string; value?: unknown; fieldValue?: unknown; fieldValueString?: unknown }[];
};

/** Whether the store is wired up at all. A missing token is a setup state, not
 *  an outage: telling an operator to "try again" would be a lie. */
export function isConfigured(): boolean {
  return Boolean(process.env.GHL_PIT && process.env.GHL_LOCATION_ID);
}

function creds() {
  const token = process.env.GHL_PIT;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new GhlError("GHL_PIT and GHL_LOCATION_ID must both be set");
  }
  return { token, locationId };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = creds();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": UA,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new GhlError(`${init.method ?? "GET"} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/* ------------------------------------------------------------ custom fields */

type FieldDef = { id: string; name: string; fieldKey: string; dataType: string };
let fieldCache: { at: number; byName: Map<string, FieldDef>; byId: Map<string, FieldDef> } | null = null;
const FIELD_TTL = 10 * 60 * 1000;

/**
 * Fields are addressed by DISPLAY NAME, never by guessed key.
 *
 * GHL derives fieldKey from the name with its own slug rules: "ACG Check-in
 * Token" becomes acg_checkin_token, "ACG Lessons Previous" becomes
 * acg_lessons_previous. Predicting that is guesswork, and a wrong key is
 * accepted with a 200 and silently discarded. So the name is the contract and
 * the real key is read back from the location.
 */
export async function fieldMap() {
  if (fieldCache && Date.now() - fieldCache.at < FIELD_TTL) return fieldCache;
  const { locationId } = creds();
  const data = await call<{ customFields: FieldDef[] }>(`/locations/${locationId}/customFields`);
  const byName = new Map<string, FieldDef>();
  const byId = new Map<string, FieldDef>();
  for (const f of data.customFields ?? []) {
    byName.set(f.name, f);
    byId.set(f.id, f);
  }
  fieldCache = { at: Date.now(), byName, byId };
  return fieldCache;
}

/** Display name -> the short key this location actually uses on writes. */
export async function shortKeys(names: string[]): Promise<Record<string, string>> {
  const { byName } = await fieldMap();
  const missing = names.filter((n) => !byName.has(n));
  if (missing.length) {
    throw new GhlError(
      `custom field(s) missing on this location: ${missing.join(", ")}. ` +
        `Writing to them would return 200 and persist nothing. Run provisioning first.`,
    );
  }
  return Object.fromEntries(
    names.map((n) => [n, byName.get(n)!.fieldKey.replace(/^contact\./, "")]),
  );
}

/** Custom field values keyed by DISPLAY NAME, whichever shape the API returned. */
export async function fieldsOf(contact: RawContact): Promise<Record<string, string>> {
  const { byId } = await fieldMap();
  const out: Record<string, string> = {};
  for (const cf of contact.customFields ?? []) {
    const def = byId.get(cf.id);
    if (!def) continue;
    const raw = cf.value ?? cf.fieldValue ?? cf.fieldValueString;
    if (raw === null || raw === undefined || raw === "") continue;
    out[def.name] = String(raw);
  }
  return out;
}

/* ----------------------------------------------------------------- contacts */

export async function searchContacts(tag?: string): Promise<RawContact[]> {
  const { locationId } = creds();
  const out: RawContact[] = [];
  let page = 1;
  for (;;) {
    const body: Record<string, unknown> = { locationId, pageLimit: 100, page };
    if (tag) body.filters = [{ field: "tags", operator: "contains", value: tag }];
    const data = await call<{ contacts?: RawContact[]; total?: number }>("/contacts/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const batch = data.contacts ?? [];
    out.push(...batch);
    if (batch.length < 100 || page >= 20) break;
    page++;
  }
  return out;
}

/** first + last is preferred: the API stores contactName lowercased, which
 *  would render "ana silva" on the dashboard. */
export function displayName(c: RawContact): string {
  const parts = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return parts || (c.contactName ?? "").trim();
}

/* ------------------------------------------------------------------- writes */

export const MEMBER_TAG = "acg:member";

/** `fields` is keyed by DISPLAY NAME; keys are resolved before sending. */
export async function upsertContact(input: {
  firstName: string;
  lastName?: string;
  email?: string;
  fields?: Record<string, string | number>;
}): Promise<RawContact> {
  const { locationId } = creds();
  const fields = input.fields ?? {};
  const keys = await shortKeys(Object.keys(fields));
  const data = await call<{ contact: RawContact }>("/contacts/upsert", {
    method: "POST",
    body: JSON.stringify({
      locationId,
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      name: [input.firstName, input.lastName].filter(Boolean).join(" "),
      ...(input.email ? { email: input.email } : {}),
      customFields: Object.entries(fields).map(([name, value]) => ({
        key: keys[name],
        field_value: String(value),
      })),
    }),
  });
  return data.contact;
}

/**
 * Update a contact already known by id. `upsert` cannot be used here: it
 * requires an email or phone to dedupe on, which a check-in payload has no
 * reason to carry. `fields` is keyed by DISPLAY NAME.
 *
 * Note this endpoint silently ignores a `tags` array — use addTags for those.
 */
export async function updateContact(
  contactId: string,
  fields: Record<string, string | number>,
): Promise<void> {
  const keys = await shortKeys(Object.keys(fields));
  await call(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({
      customFields: Object.entries(fields).map(([name, value]) => ({
        key: keys[name],
        field_value: String(value),
      })),
    }),
  });
}

/** PUT /contacts/{id} with {tags:[...]} returns 200 and persists nothing.
 *  This endpoint returns the merged array, so assert on that, not on tagsAdded. */
export async function addTags(contactId: string, tags: string[]): Promise<string[]> {
  const data = await call<{ tags?: string[] }>(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
  return data.tags ?? [];
}

/** Append-only audit line in the contact timeline. This is the recovery path if
 *  a custom field write silently no-ops and the previous value is lost. */
export async function removeTags(contactId: string, tags: string[]): Promise<void> {
  if (!tags.length) return;
  await call(`/contacts/${contactId}/tags`, {
    method: "DELETE",
    body: JSON.stringify({ tags }),
  });
}

export async function addNote(contactId: string, body: string): Promise<void> {
  await call(`/contacts/${contactId}/notes`, { method: "POST", body: JSON.stringify({ body }) });
}

export async function getContact(contactId: string): Promise<RawContact> {
  const data = await call<{ contact: RawContact }>(`/contacts/${contactId}`);
  return data.contact;
}

/** Writes, then re-reads independently. A 200 is not evidence the value landed. */
export async function writeFieldsVerified(
  contactId: string,
  fields: Record<string, string | number>,
): Promise<void> {
  await updateContact(contactId, fields);
  const after = await fieldsOf(await getContact(contactId));
  // Only non-empty values are verifiable. An empty value is stored as absent,
  // so asserting on it reports drift for a write that behaved correctly, and a
  // verifier that cries wolf is worse than none. Clearing stays best-effort.
  const drifted = Object.entries(fields)
    .filter(([, v]) => String(v) !== "")
    .filter(([k, v]) => after[k] !== String(v));
  if (drifted.length) {
    throw new GhlError(
      `write reported success but did not persist: ${drifted.map(([k]) => k).join(", ")}`,
    );
  }
}
