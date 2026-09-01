import { notFound } from "next/navigation";
import { dbQuery } from "@/lib/db";
import { MEMBER_BY_TOKEN_SQL, MODULE_OPTIONS_SQL, MODULES_SQL } from "@/lib/sql";
import { CheckinForm } from "@/components/member-form";
import { branding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check in" };

export default async function Checkin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const q = dbQuery();
  const found = await q(MEMBER_BY_TOKEN_SQL, [token]);
  if (!found.length) notFound();
  const member = found[0] as { full_name: string; stage: string };

  const [opts, mods] = await Promise.all([q(MODULE_OPTIONS_SQL), q(MODULES_SQL)]);
  const modules = opts.map((m) => ({ key: String(m.module_key), label: String(m.label) }));
  const totalLessons = mods
    .filter((m) => Boolean(m.visible_precert))
    .reduce((t, m) => t + (Number(m.lessons) || 0), 0);

  return (
    <main className="mx-auto w-full max-w-xl p-6 md:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">{branding.groupName} · check-in</p>
        <h1 className="mt-2 text-2xl">Where are you, {member.full_name.split(" ")[0]}?</h1>
        <p className="mt-2 text-sm text-muted">
          Under a minute. It means the session goes on what&apos;s actually blocking people
          instead of a round of status updates.
        </p>
      </header>
      <CheckinForm token={token} memberName={member.full_name} stage={member.stage}
        modules={modules} totalLessons={totalLessons} progressHint={branding.progressHint} />
    </main>
  );
}
