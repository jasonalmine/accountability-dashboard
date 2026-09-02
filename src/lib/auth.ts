/**
 * Facilitator session cookie.
 *
 * The cookie previously held the literal string "authenticated" and the proxy
 * accepted anything equal to it, so setting one cookie in devtools granted the
 * whole dashboard without the password. The value is now an expiry signed with
 * TOKEN_SECRET, which a client cannot produce.
 *
 * Web Crypto rather than node:crypto: this runs inside proxy.ts on the Edge
 * runtime, where node:crypto and Buffer do not exist. Web Crypto is available
 * both there and in the Node route handler.
 */
export const AUTH_COOKIE = "acg-auth";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("TOKEN_SECRET must be set to at least 16 characters");
  }
  return s;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

/** Compares without leaking where two equal-length strings first differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `<expiry unix seconds>.<hmac>` */
export async function makeSession(now: number = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SESSION_MAX_AGE_S;
  return `${exp}.${await sign(String(exp))}`;
}

export async function readSession(value: string | undefined, now: number = Date.now()): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^\d{1,12}$/.test(exp)) return false;
  if (Number(exp) * 1000 <= now) return false;
  try {
    return safeEqual(await sign(exp), sig);
  } catch {
    // A missing or too-short TOKEN_SECRET must send the facilitator to /login,
    // not 500 the dashboard from inside the proxy.
    return false;
  }
}
