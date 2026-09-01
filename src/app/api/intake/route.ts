import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { dbQuery } from "@/lib/db";
import { notifyN8n } from "@/lib/n8n";
import { UPSERT_INTAKE_SQL } from "@/lib/sql";

export async function POST(request: Request) {
  let body: { name?: string; email?: string; batch?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const batch = (body.batch ?? "").trim();

  if (!name || !batch) return NextResponse.json({ error: "Pick your name and batch." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  try {
    const q = dbQuery();
    const rows = await q(UPSERT_INTAKE_SQL, [name, email, batch, randomBytes(16).toString("hex")]);
    if (!rows.length) {
      return NextResponse.json({ error: "We don't have that name on the roster. Ask a facilitator to add you." }, { status: 404 });
    }
    const member = rows[0] as { id: number; full_name: string; token: string };
    await notifyN8n("intake", member);
    return NextResponse.json({ ok: true, checkinPath: `/checkin/${member.token}` });
  } catch (err) {
    console.error("intake failed:", err);
    return NextResponse.json({ error: "Could not save that. Try again in a moment." }, { status: 500 });
  }
}
