import Link from "next/link";
import { isConfigured } from "@/lib/ghl";
import { BATCHES } from "@/lib/course";
import { IntakeForm } from "@/components/member-form";
import { branding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join the group" };

export default async function Join() {
  if (!isConfigured()) return <NotConfigured />;

  return (
    <main className="mx-auto w-full max-w-xl p-6 md:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">{branding.groupName}</p>
        <h1 className="mt-2 text-2xl">Register once, then you&apos;re set</h1>
        <p className="mt-2 text-sm text-muted">
          Takes about 30 seconds. You&apos;ll get a personal check-in link you use
          before every session, so there&apos;s nothing to log into and nothing to remember.
        </p>
      </header>
      <IntakeForm batches={BATCHES} />
      <footer className="mt-10 flex flex-wrap justify-between gap-3 text-xs text-muted">
        <span>{branding.sessions ? `Sessions: ${branding.sessions}` : ""}</span>
        <Link href="/checkin" className="text-muted hover:text-foreground">Already registered? Check in</Link>
        <Link href="/dashboard" className="text-muted hover:text-foreground">Facilitator sign-in</Link>
      </footer>
    </main>
  );
}

function NotConfigured() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl">Not connected yet</h1>
      <p className="mt-3 text-sm text-muted">
        This dashboard has no data source. Set <code className="text-foreground">GHL_PIT</code> and{" "}
        <code className="text-foreground">GHL_LOCATION_ID</code>, then redeploy.
      </p>
      <p className="mt-2 text-sm text-muted">
        Refreshing will not change this. See the README for setup.
      </p>
    </main>
  );
}
