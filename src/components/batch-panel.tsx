import { Card, Bar } from "./ui";
import type { Member, Progress } from "@/lib/types";

export function BatchPanel({ members, progress }: { members: Member[]; progress: Progress[] }) {
  const batches = [...new Set(members.map((m) => m.batch).filter(Boolean))].sort();

  return (
    <Card title="By batch" note="Batches appear here once members complete intake.">
      {!batches.length && (
        <p className="text-sm text-muted">No batch data yet. Nobody has completed intake.</p>
      )}
      <ul className="space-y-3">
        {batches.map((b) => {
          const inBatch = progress.filter((p) => p.batch === b);
          const scored = inBatch.filter((p) => p.percent !== null && p.percent > 0);
          const avg = scored.length
            ? scored.reduce((t, p) => t + (p.percent ?? 0), 0) / scored.length
            : null;
          return (
            <li key={b}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{b}</span>
                <span className="text-muted">{inBatch.length} member{inBatch.length === 1 ? "" : "s"}</span>
              </div>
              <Bar percent={avg} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
