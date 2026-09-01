import { notFound, unstable_rethrow } from "next/navigation";
import { dbQuery } from "@/lib/db";
import { MEMBER_BY_TOKEN_SQL, MODULE_OPTIONS_SQL, MODULES_SQL } from "@/lib/sql";
import { CheckinForm } from "@/components/member-form";
import { branding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check in" };

export default async function Checkin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // A database problem and an unrecognised token are different failures and must
  // not collapse into the same 500: an unknown token is a 404, and an outage is a
  // "try again" the member can act on. Without this split, an unreachable database
  // makes every check-in link look permanently broken.
  let member: { full_name: string; stage: string };
  let modules: { key: string; label: string }[];
  let totalLessons: number;
  try {
    const q = dbQuery();
    const found = await q(MEMBER_BY_TOKEN_SQL, [token]);
    if (!found.length) notFound();
    member = found[0] as { full_name: string; stage: string };

    const [opts, mods] = await Promise.all([q(MODULE_OPTIONS_SQL), q(MODULES_SQL)]);
    modules = opts.map((m) => ({ key: String(m.module_key), label: String(m.label) }));
    totalLessons = mods
      .filter((m) => Boolean(m.visible_precert))
      .reduce((t, m) => t + (Number(m.lessons) || 0), 0);
  } catch (err) {
    // notFound() throws an internal Next signal that a try/catch would swallow,
    // stopping not-found.tsx from ever rendering. unstable_rethrow is the
    // documented way to let it through.
    unstable_rethrow(err);
    console.error("check-in page load failed:", err);
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl">Check-in is briefly unavailable</h1>
        <p className="mt-2 text-sm text-muted">
          Give it a minute and refresh. Your link is still valid.
        </p>
      </main>
    );
  }

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
