import Link from "next/link";
import { dbQuery } from "@/lib/db";
import { BATCHES_SQL, ROSTER_SQL } from "@/lib/sql";
import { IntakeForm } from "@/components/member-form";
import { branding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join the group" };

export default async function Join() {
  let roster: string[] = [];
  let batches: string[] = [];
  try {
    const q = dbQuery();
    const [r, b] = await Promise.all([q(ROSTER_SQL), q(BATCHES_SQL)]);
    roster = r.map((x) => String(x.full_name));
    batches = b.map((x) => String(x.name));
  } catch (err) {
    console.error("join page load failed:", err);
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl">Registration is briefly unavailable</h1>
        <p className="mt-2 text-sm text-muted">Give it a minute and refresh. Nothing you typed was lost.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl p-6 md:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">{branding.groupName}</p>
        <h1 className="mt-2 text-2xl">Register once, then you&apos;re set</h1>
        <p className="mt-2 text-sm text-muted">
          Takes about 30 seconds. You&apos;ll get a personal check-in link you use before every
          session, so there&apos;s nothing to log into and nothing to remember.
        </p>
      </header>
      <IntakeForm roster={roster} batches={batches} />
      <footer className="mt-10 flex flex-wrap justify-between gap-3 text-xs text-muted">
        <span>{branding.sessions ? `Sessions: ${branding.sessions}` : ""}</span>
        <Link href="/dashboard" className="text-muted hover:text-foreground">Facilitator sign-in</Link>
      </footer>
    </main>
  );
}
