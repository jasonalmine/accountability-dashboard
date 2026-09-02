import { unstable_rethrow } from "next/navigation";
import { F, loadRegistered, MODULE_OPTIONS } from "@/lib/store";
import { denominatorFor } from "@/lib/course";
import { PickerCheckinForm, type PickerMember } from "@/components/member-form";
import { branding } from "@/lib/branding";
import { isConfigured } from "@/lib/ghl";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Check in",
  // Public and unauthenticated, and it lists everyone's name. Keep it out of search.
  robots: { index: false, follow: false },
};

export default async function SharedCheckin() {
  if (!isConfigured()) return <NotConfigured />;

  let members: PickerMember[];
  try {
    const registered = await loadRegistered();
    members = registered
      .map((m) => ({
        contactId: m.contactId,
        name: m.name,
        stage: m.fields[F.stage] ?? "",
        // The bound the API enforces, so the percentage a member sees matches
        // the number that will actually be accepted.
        totalLessons: denominatorFor(m.fields[F.stage] ?? ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    unstable_rethrow(err);
    console.error("shared check-in page load failed:", err);
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl">Check-in is briefly unavailable</h1>
        <p className="mt-2 text-sm text-muted">Give it a minute and refresh.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl p-6 md:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">{branding.groupName} · check-in</p>
        <h1 className="mt-2 text-2xl">Where are you?</h1>
        <p className="mt-2 text-sm text-muted">
          Under a minute. It means the session goes on what&apos;s actually blocking people
          instead of a round of status updates.
        </p>
      </header>
      {members.length === 0 ? (
        <p className="text-sm text-muted">Nobody has registered yet.</p>
      ) : (
        <PickerCheckinForm
          members={members}
          modules={MODULE_OPTIONS}
          progressHint={branding.progressHint}
        />
      )}
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
    </main>
  );
}
