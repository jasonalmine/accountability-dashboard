import { notFound, unstable_rethrow } from "next/navigation";
import { memberByToken, MODULE_OPTIONS, type MemberRecord } from "@/lib/store";
import { TOTAL_LESSONS } from "@/lib/course";
import { CheckinForm } from "@/components/member-form";
import { branding } from "@/lib/branding";
import { isConfigured } from "@/lib/ghl";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check in" };

export default async function Checkin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isConfigured()) return <NotConfigured />;

  // An unrecognised token and an upstream outage are different failures: the
  // first is a 404, the second is a "try again". Collapsing them into one 500
  // makes every member's link look permanently broken during a blip.
  let member: MemberRecord;
  try {
    const found = await memberByToken(token);
    if (!found) notFound();
    member = found;
  } catch (err) {
    unstable_rethrow(err);
    console.error("check-in page load failed:", err);
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl">Check-in is briefly unavailable</h1>
        <p className="mt-2 text-sm text-muted">Give it a minute and refresh. Your link is still valid.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl p-6 md:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">{branding.groupName} · check-in</p>
        <h1 className="mt-2 text-2xl">Where are you, {member.name.split(" ")[0]}?</h1>
        <p className="mt-2 text-sm text-muted">
          Under a minute. It means the session goes on what&apos;s actually blocking people
          instead of a round of status updates.
        </p>
      </header>
      <CheckinForm token={token} memberName={member.name} stage={member.fields.acg_stage ?? ""}
        modules={MODULE_OPTIONS} totalLessons={TOTAL_LESSONS} progressHint={branding.progressHint} />
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
