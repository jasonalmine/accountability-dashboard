import { loadDashboard } from "@/lib/store";
import { Kpi } from "@/components/ui";
import { ProgressTable } from "@/components/progress-table";
import { ModuleChart } from "@/components/module-chart";
import { AttentionPanel } from "@/components/attention-panel";
import { BatchPanel } from "@/components/batch-panel";
import { SessionView } from "@/components/session-view";
import { RefreshButton } from "@/components/refresh-button";
import type { DashboardData } from "@/lib/types";
import { branding, subtitle } from "@/lib/branding";

// Read on the server on every request. Keeps the service-account key off the
// client entirely and avoids a fetch waterfall behind the auth cookie.
export const dynamic = "force-dynamic";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function Home() {
  let data: DashboardData;
  try {
    data = await loadDashboard();
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-lg">Could not load the tracker</h1>
        <p className="mt-2 text-sm text-muted">{detail}</p>
        <p className="mt-4 text-sm text-muted">
          Most likely GHL_PIT or GHL_LOCATION_ID is unset, or the custom fields
          have not been provisioned on that location yet. See the README.
        </p>
      </main>
    );
  }

  const { kpis, progress, modules, members, checkins } = data;

  return (
    <main className="mx-auto w-full max-w-7xl p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">{branding.groupName}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle(data.totalLessons)}</p>
        </div>
        <RefreshButton />
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Average completion" value={pct(kpis.avgCompletion)} note="Members with a check-in" />
        <Kpi
          label="Checked in this week" value={`${kpis.checkedInRecently}/${kpis.active}`}
          note={`${pct(kpis.compliance)} compliance`}
          tone={kpis.compliance < 0.5 ? "warn" : "ok"}
        />
        <Kpi
          label="Needs a nudge" value={String(kpis.needsAttention)}
          note="Stalled or not moving" tone={kpis.needsAttention > 0 ? "alert" : "ok"}
        />
        <Kpi
          label="Intake outstanding" value={String(kpis.intakeOutstanding)}
          note="Cannot be emailed yet" tone={kpis.intakeOutstanding > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ModuleChart modules={modules} progress={progress} /></div>
        <div className="grid gap-4">
          <AttentionPanel rows={progress} />
          <BatchPanel members={members} progress={progress} />
        </div>
      </div>

      <div className="mb-6"><ProgressTable rows={progress} /></div>
      <SessionView checkins={checkins} />

      <footer className="mt-8 text-xs text-muted">
        Self-reported from each member&apos;s own course page.
      </footer>
    </main>
  );
}
