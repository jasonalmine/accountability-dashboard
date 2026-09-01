import { NextResponse } from "next/server";
import { recordIntake } from "@/lib/store";
import { notifyN8n } from "@/lib/n8n";

export async function POST(request: Request) {
  let body: { firstName?: string; lastName?: string; email?: string; batch?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const firstName = (body.firstName ?? "").trim().replace(/\s+/g, " ");
  const lastName = (body.lastName ?? "").trim().replace(/\s+/g, " ");
  const email = (body.email ?? "").trim().toLowerCase();
  const batch = (body.batch ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Enter your first and last name." }, { status: 400 });
  }
  if (firstName.length > 60 || lastName.length > 60) {
    return NextResponse.json({ error: "That name looks too long." }, { status: 400 });
  }
  if (!batch) return NextResponse.json({ error: "Pick your batch." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  try {
    const result = await recordIntake(firstName, lastName, email, batch);
    await notifyN8n("intake", result);
    return NextResponse.json({ ok: true, checkinPath: `/checkin/${result.token}` });
  } catch (err) {
    console.error("intake failed:", err);
    return NextResponse.json({ error: "Could not save that. Try again in a moment." }, { status: 500 });
  }
}
