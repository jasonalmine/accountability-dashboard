import { NextResponse } from "next/server";
import { memberByToken, recordCheckin } from "@/lib/store";
import { notifyN8n } from "@/lib/n8n";

export async function POST(request: Request) {
  let body: {
    token?: string; lessonsDone?: unknown; currentModule?: string;
    completed?: string; blocker?: string; commitment?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const lessons = Number(body.lessonsDone);
  if (!Number.isInteger(lessons) || lessons < 0 || lessons > 500) {
    return NextResponse.json({ error: "Lessons completed must be a whole number." }, { status: 400 });
  }
  if (!body.currentModule) return NextResponse.json({ error: "Pick the module you're in." }, { status: 400 });
  if (!(body.commitment ?? "").trim()) {
    return NextResponse.json({ error: "Say what you'll finish before the next session." }, { status: 400 });
  }

  try {
    const member = await memberByToken(body.token ?? "");
    if (!member) return NextResponse.json({ error: "That link is no longer valid." }, { status: 401 });

    await recordCheckin(member, {
      lessonsDone: lessons,
      currentModule: body.currentModule,
      completed: (body.completed ?? "").trim(),
      blocker: (body.blocker ?? "").trim(),
      commitment: (body.commitment ?? "").trim(),
    });
    await notifyN8n("checkin", { name: member.name, contactId: member.contactId, lessonsDone: lessons });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("checkin failed:", err);
    return NextResponse.json({ error: "Could not save that. Try again in a moment." }, { status: 500 });
  }
}
