import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A check-in link carries the contact id, signed.
 *
 * The obvious alternative — a random token stored in a custom field — means
 * resolving a link by searching every contact for a match. That search index
 * lags writes by seconds, so a member who registers and immediately clicks
 * their own link gets told it is invalid. Signing the id removes the lookup
 * entirely: verify, then fetch that one contact by id.
 */
function secret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("TOKEN_SECRET must be set to at least 16 characters");
  }
  return s;
}

const b64url = (b: Buffer) => b.toString("base64url");
const sign = (id: string) =>
  b64url(createHmac("sha256", secret()).update(id).digest()).slice(0, 27);

export function makeToken(contactId: string): string {
  return `${b64url(Buffer.from(contactId))}.${sign(contactId)}`;
}

/** Returns the contact id, or null if the token is malformed or unsigned. */
export function readToken(token: string): string | null {
  const [idPart, sig] = (token ?? "").split(".");
  if (!idPart || !sig) return null;
  let contactId: string;
  try {
    contactId = Buffer.from(idPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!contactId || !/^[A-Za-z0-9_-]{10,50}$/.test(contactId)) return null;
  const expected = Buffer.from(sign(contactId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? contactId : null;
}
