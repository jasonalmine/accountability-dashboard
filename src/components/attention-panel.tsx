import { Card } from "./ui";
import type { Progress } from "@/lib/types";

export function AttentionPanel({ rows }: { rows: Progress[] }) {
  const stalled = rows.filter((r) => r.status === "STALLED");
  const stuck = rows.filter((r) => r.status === "NO MOVEMENT");

  return (
    <Card title="Needs a nudge" note="Address these by name during check-in.">
      {!stalled.length && !stuck.length && (
        <p className="text-sm text-muted">Nobody is stalled. Good week.</p>
      )}
      {stalled.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-alert">
            Stalled · no check-in in over 10 days
          </h3>
          <ul className="space-y-1 text-sm">
            {stalled.map((r) => (
              <li key={r.name} className="flex justify-between gap-3">
                <span>{r.name}</span>
                <span className="tnum text-muted">{r.daysSince}d</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {stuck.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-wide text-warn">
            No movement · checked in but finished nothing
          </h3>
          <ul className="space-y-1 text-sm">
            {stuck.map((r) => (
              <li key={r.name} className="flex justify-between gap-3">
                <span>{r.name}</span>
                <span className="text-muted">{r.currentModule || "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
