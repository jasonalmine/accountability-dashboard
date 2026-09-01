import { makeToken, readToken } from "../src/lib/token";
let fails = 0;
const check = (l: string, a: unknown, e: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${ok ? "" : `  got ${JSON.stringify(a)}`}`);
};
process.env.TOKEN_SECRET = "test-secret-at-least-16-chars";

const id = "M1ubnMjWujmb6eB9xjYQ";
const t = makeToken(id);
check("round-trips", readToken(t), id);
check("stable for the same id", makeToken(id), t);
check("differs per id", makeToken("Zother1234567890abcd") !== t, true);
check("rejects tampered signature", readToken(t.split(".")[0] + ".AAAAAAAAAAAAAAAAAAAAAAAAAAA"), null);
check("rejects tampered id", readToken(Buffer.from("Zother1234567890abcd").toString("base64url") + "." + t.split(".")[1]), null);
check("rejects garbage", readToken("nonsense"), null);
check("rejects empty", readToken(""), null);
check("rejects missing signature", readToken(t.split(".")[0]), null);
check("rejects id-shaped injection", readToken(Buffer.from("../../etc/passwd").toString("base64url") + "." + t.split(".")[1]), null);

process.env.TOKEN_SECRET = "a-completely-different-secret-value";
check("a different secret invalidates old links", readToken(t), null);

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`}`);
process.exit(fails ? 1 : 0);
