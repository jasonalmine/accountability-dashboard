/** The shared /checkin page identifies a member by contact id, so the MEMBER_TAG
 *  check in memberByContactId is the only thing stopping an arbitrary CRM contact
 *  from being checked in against. Network is stubbed; no real GHL call is made. */
process.env.GHL_PIT ??= "pit-test";
process.env.GHL_LOCATION_ID ??= "loc-test";

let fails = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};

type Contact = { id: string; firstName?: string; lastName?: string; tags?: string[]; customFields?: [] };
const CONTACTS: Record<string, Contact> = {
  taggedmember01: { id: "taggedmember01", firstName: "Ana", lastName: "Silva", tags: ["acg:member"], customFields: [] },
  untaggedperson: { id: "untaggedperson", firstName: "Random", lastName: "Lead", tags: ["some:other"], customFields: [] },
};

let calls = 0;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  calls++;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.includes("/customFields")) return json({ customFields: [] });
  const m = url.match(/\/contacts\/([^/?]+)/);
  if (m) {
    const c = CONTACTS[m[1]];
    return c ? json({ contact: c }) : json({ message: "not found" }, 404);
  }
  return json({}, 404);
}) as typeof fetch;

const { memberByContactId } = await import("../src/lib/store");

console.log("shared check-in identity");

const before = calls;
check("empty id rejected", await memberByContactId(""), null);
check("malformed id rejected", await memberByContactId("nope!"), null);
check("short id rejected", await memberByContactId("abc"), null);
check("rejected without touching the network", calls, before);

check("unknown contact rejected", await memberByContactId("doesnotexist1"), null);

const untagged = await memberByContactId("untaggedperson");
check("contact without the member tag rejected", untagged, null);

const ok = await memberByContactId("taggedmember01");
check("tagged member resolves", ok?.contactId, "taggedmember01");
check("resolves the display name", ok?.name, "Ana Silva");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
