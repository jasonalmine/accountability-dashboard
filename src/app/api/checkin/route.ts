import { NextResponse } from "next/server";
import { F, memberByContactId, memberByToken, recordCheckin } from "@/lib/store";
import { denominatorFor } from "@/lib/course";
import { notifyN8n } from "@/lib/n8n";

export async function POST(request: Request) {
  let body: {
    token?: string; contactId?: string; lessonsDone?: unknown; currentModule?: string;
    completed?: string; blocker?: string; commitment?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const lessons = Number(body.lessonsDone);
  if (!Number.isInteger(lessons) || lessons < 0) {
    return NextResponse.json({ error: "Lessons completed must be a whole number." }, { status: 400 });
  }
  if (!body.currentModule) return NextResponse.json({ error: "Pick the module you're in." }, { status: 400 });
  if (!(body.commitment ?? "").trim()) {
    return NextResponse.json({ error: "Say what you'll finish before the next session." }, { status: 400 });
  }

  try {
    // Two entry points. A personal link proves identity by its signature; the
    // shared /checkin page identifies the member by the name they picked, which
    // proves nothing. Both resolve to the same record and the same validation.
    const member = body.token
      ? await memberByToken(body.token)
      : await memberByContactId(typeof body.contactId === "string" ? body.contactId : "");
    if (!member) {
      return NextResponse.json(
        { error: body.token ? "That link is no longer valid." : "Pick your name from the list." },
        { status: body.token ? 401 : 400 },
      );
    }

    // The upper bound is the member's own course total. A typo of 420 for 42
    // otherwise passes validation, renders as a clamped 100% bar, and silently
    // inflates the cohort average with the unclamped value behind it.
    const max = denominatorFor(member.fields[F.stage] ?? "");
    if (lessons > max) {
      return NextResponse.json(
        { error: `That is more than the ${max} lessons in the course. Check the number and try again.` },
        { status: 400 },
      );
    }

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
