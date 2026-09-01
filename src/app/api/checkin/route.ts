import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { notifyN8n } from "@/lib/n8n";
import { INSERT_CHECKIN_SQL, MEMBER_BY_TOKEN_SQL } from "@/lib/sql";

export async function POST(request: Request) {
  let body: {
    token?: string; lessonsDone?: unknown; currentModule?: string;
    stage?: string; completed?: string; blocker?: string; commitment?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const lessons = Number(body.lessonsDone);
  if (!Number.isInteger(lessons) || lessons < 0 || lessons > 200) {
    return NextResponse.json({ error: "Lessons completed must be a whole number." }, { status: 400 });
  }
  if (!body.currentModule) return NextResponse.json({ error: "Pick the module you're in." }, { status: 400 });
  if (!(body.commitment ?? "").trim()) {
    return NextResponse.json({ error: "Say what you'll finish before the next session." }, { status: 400 });
  }

  try {
    const q = dbQuery();
    const found = await q(MEMBER_BY_TOKEN_SQL, [body.token ?? ""]);
    if (!found.length) return NextResponse.json({ error: "That link is no longer valid." }, { status: 401 });
    const member = found[0] as { id: number; full_name: string; stage: string };

    const rows = await q(INSERT_CHECKIN_SQL, [
      member.id,
      body.stage || member.stage,
      lessons,
      body.currentModule,
      (body.completed ?? "").trim() || null,
      (body.blocker ?? "").trim() || null,
      (body.commitment ?? "").trim(),
    ]);
    await notifyN8n("checkin", { member, checkin: rows[0], lessonsDone: lessons });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("checkin failed:", err);
    return NextResponse.json({ error: "Could not save that. Try again in a moment." }, { status: 500 });
  }
}
